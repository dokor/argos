# Premium : Stripe Checkout et Billing (#733)

Ce lot prépare le parcours autonome FR/EN `/account/billing` et `/en/account/billing`.
Il ne lance aucune offre commerciale. Les montants et la réduction annuelle restent à
arrêter ; aucun produit, tarif, abonnement ou paiement Stripe réel n'est créé par cette PR.

## Verrous de lancement

Les valeurs de référence restent `billing.enabled=false`,
`billing.payments-enabled=false`, `billing.prices-approved=false`,
`billing.launch-approved=false`, `billing.tax-ready=false` et
`premium-ci.enabled=false`. Le scheduler de facturation ne fait alors aucun accès
Stripe. Le GET de compte reste une lecture locale sans provisionnement ni droits.
La recette globale #467, les tarifs et les règles commerciales/fiscales doivent être
validés avant toute activation. Ne pas confondre activation des paiements et activation CI.

Après ces validations seulement, fournir via la configuration serveur montée en secret :

| Configuration `billing.*` | Valeur attendue |
| --- | --- |
| `account-id`, `product-id` | Marchand et produit Stripe attendus |
| `monthly-price-id`, `annual-price-id` | Deux prix récurrents distincts, EUR, taxe exclusive, quantité 1, mois/an |
| `monthly-amount-ht-cents`, `annual-amount-ht-cents` | Montants entiers approuvés en centimes ; annuel inférieur à 12 mensualités |
| `portal-config-id` | Configuration active : factures, moyen de paiement et annulation en fin de période ; changement d'offre désactivé |
| `api-key`, `webhook-secret` | Secrets serveur distincts test/live, jamais dans Next public, logs ou navigateur |
| `live-mode` | Environnement explicitement choisi, cohérent avec les clés/objets |
| `reconciliation-batch-size` | 20 par défaut, 1–100 ; limite de travail, sans file infinie |

Le démarrage refuse une configuration activée incomplète. Une clé restreinte est à
privilégier : lecture compte, clients/recherche, prix, abonnements, factures et paiements
de factures, PaymentIntents, charges, configurations du portail et sessions Checkout ;
écriture clients et sessions Checkout/portail uniquement. Vérifier les permissions
effectives en sandbox ; ne pas élargir automatiquement les droits en cas d'erreur.
L'API n'a aucune opération de création de prix, remboursement ou modification directe
d'abonnement. Le portail n'autorise pas de changement de prix/quantité.

Stripe Tax et les inscriptions fiscales du marchand doivent être validés séparément.
L'interface affiche l'EUR HT en principal, et précise que le TTC applicable est présenté
avant paiement par Stripe selon la situation du client. Aucun taux de TVA universel
n'est supposé. Les valeurs présentes dans les tests sont exclusivement fictives.

## Attribution et sécurité

- Compte Argos actif, adresse vérifiée, session propriétaire, CSRF, réauthentification
  récente et limitation persistante des mutations sont requis. Le client fournit
  seulement `MONTH` ou `YEAR` ; jamais de customer, prix, montant, abonnement ou URL de retour.
- Le serveur fixe marchand, environnement, produit, prix, client et origine HTTPS.
  Aucun droit ne dépend du retour Checkout, d'un paramètre navigateur ou du contenu
  déclaratif d'un webhook. Le navigateur ne reçoit que le résumé de son compte.
- Le client Stripe utilise uniquement `https://api.stripe.com`, sans redirection,
  version `2026-09-30.endive`, connexion 3 s, réponse totale 8 s/512 Kio,
  huit appels simultanés maximum. Les parcours bornent appels, pagination et durée.
- Les destinations hébergées sont validées dans Java, le BFF et le client : HTTPS,
  domaines `checkout.stripe.com` / `billing.stripe.com` et chemins dédiés.
  Ces URL porteuses d'accès restent éphémères, sans persistance ni journalisation.
- L'intention Checkout, son prix, sa langue, son origine et sa clé d'idempotence sont
  persistés avant l'appel. Un timeout conduit à retrouver/reprendre la même session,
  sans changement de périodicité. Une session complète doit être synchronisée avant
  toute nouvelle tentative ; une session expirée est vérifiée chez Stripe.
- La fenêtre de rejeu automatique de création est limitée à 23 h. Après cette fenêtre,
  une création client incertaine passe par une recherche en lecture seule sur une liaison
  opaque. Une recherche vide, éventuellement consistante, n'autorise jamais une nouvelle
  création aveugle. Une ambiguïté durable reste bloquée avec diagnostic explicite.
- Les décisions administratives et droits manuels existants ne sont pas remplacés.
  Un changement de droits n'empêche pas le propriétaire actif d'accéder au portail
  de factures/annulation, qui ne projette aucun droit. Une suspension administrative
  conserve son effet de sécurité ; sa procédure doit traiter séparément tout abonnement
  facturable avant lancement (ne pas laisser un client suspendu sans moyen d'annulation).
  Une transaction verrouille compte, droits CI puis facturation ; un bail et une génération
  empêchent les synchronisations concurrentes de publier une observation périmée.

## Webhook et réconciliation

Endpoint public exclusivement authentifié par signature Stripe :
`POST /api/billing/stripe/webhook`. Configurer la même version API et le même environnement.
Le proxy doit transmettre les octets et `Stripe-Signature` sans décoder/recomposer le JSON.
Pas de cookie, secret CI ou jeton Argos à fournir à Stripe.

Événements utilisés : `checkout.session.completed`, `checkout.session.expired`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
`invoice.payment_action_required`, `invoice.marked_uncollectible`,
`charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `charge.dispute.updated`.
Le code reste l'autorité pour la liste exacte ; les types inconnus sont acquittés sans effet.

Signature HMAC sur le corps brut, comparaison constante, tolérance temporelle 5 min,
corps 256 Kio maximum, lecture 3 s, huit lecteurs actifs maximum ; JSON ambigu,
compression, Connect, version/environnement incorrects refusés. Les événements d'un
client inconnu sont sans effet. Un événement connu ne fait qu'enregistrer son identifiant
unique et son empreinte, puis programmer la relecture ; pas d'appel Stripe sur ce chemin.
Le doublon n'a aucun effet supplémentaire ; une collision d'identifiant/corps est refusée.
Le journal ne conserve aucun corps brut et est purgé après 90 jours par lots bornés.

Le scheduler relit l'état actuel, toutes les minutes, sans ordre supposé des événements :
abonnement unique, client lié, prix, période courante, facture payée, PaymentIntent et
charge effectivement payés, absence de remboursement/litige. Les essais gratuits,
factures à zéro/crédit/partiellement payées, configurations inconnues et doublons
d'abonnement n'ouvrent pas de droits dans cette première politique conservatrice.
Le budget du tick est 45 s, avec 25 s réservées avant chaque nouvelle lecture.
Une synchronisation réussie programme la suivante à 5 min ; les échecs espacés vont
de 1 à 15 min, puis 1 h après six échecs. Aucune relance ne crée de paiement.

Une observation payée accorde des droits Stripe au plus 15 min, bornés par la fin de
période. Une panne prolongée expire ces droits ; impayé, remboursement même partiel,
litige ou fin d'abonnement retirent les nouveaux droits. Les rapports, clés, quotas
consommés et audits admis ne sont ni supprimés ni réinitialisés. L'annulation en fin de
période conserve l'accès payé jusqu'à cette date, sous réserve des contrôles précédents.

La fermeture du compte est refusée tant qu'un abonnement non terminé, un Checkout
incertain/ouvert ou un bail actif subsiste : message FR/EN et lien Premium. La présente
politique exige donc d'attendre la fin effective après une annulation en fin de période.
**Cette contrainte, la politique de grâce, les remboursements, litiges, crédits et les
modalités fiscales doivent être arbitrés avant lancement**, en particulier pour l'annuel.

## Erreurs et reprise sans divulgation

Les réponses contrôlées exposent un code stable et un `requestId` aléatoire :
`billing_disabled`, `billing_configuration`, `billing_sync_pending`,
`billing_payment_required`, `billing_existing_subscription`, `billing_interval_locked`,
`billing_managed_elsewhere`, `billing_unavailable`, `billing_request_invalid`,
`billing_webhook_invalid`. Les refus de compte/CSRF/réauthentification restent distincts.
Les erreurs fournisseur et les URL, secrets, emails, identifiants Stripe et données de
carte ne sont jamais renvoyés dans le diagnostic. Réponses privées `no-store`.

L'UI explique une réponse incertaine, retire l'action payable et propose une lecture
explicite de l'état. Pas de retry automatique de Checkout. Le diagnostic copiable est
volontaire et minimal ; ne pas demander de logs CI bruts, de secret ou d'URL Checkout.
En exploitation, corréler le `requestId`/code, vérifier la configuration et l'état Stripe
depuis les outils autorisés, puis laisser la relecture reprendre. Ne jamais accorder
Premium par SQL pour contourner un paiement ambigu, ni effacer l'intention pour réessayer.

## Preuves et recette restante

Tests unitaires avec fournisseur synthétique, tests MariaDB isolés `BillingIT`,
contrats BFF/client, états UI FR/EN, thèmes, clavier et tailles 320/390/768/1440.
Les fixtures frontend sont dans le contexte Docker `apps/console-web`.
La matrice visuelle ajoute le groupe `billing` ; aucun de ces tests ne débite Stripe.

Avant activation #467 : valider en sandbox Stripe réelle les schémas/version, clé
restreinte, Checkout/Tax/portail, facture EUR HT/TTC mensuelle et annuelle, abandon,
timeout/rejeu, impayé et récupération, renouvellement, annulation/fin, remboursement,
litige, webhook signé retardé/dupliqué/désordonné, isolation entre deux comptes et
survie des audits/rapports. Vérifier la migration V47 et un rollback opérationnel des
flags. Ne jamais désactiver la réconciliation d'abonnements réels sans procédure de
continuité : `payments-enabled=false` peut suspendre les nouvelles ventes en conservant
la lecture et le portail lorsque `enabled=true`. Les deux restent `false` dans ce lot.

Sources : [webhooks Stripe](https://docs.stripe.com/webhooks),
[idempotence](https://docs.stripe.com/api/idempotent_requests),
[Checkout Tax](https://docs.stripe.com/tax/checkout),
[recherche clients](https://docs.stripe.com/api/customers/search),
[événements d'abonnement](https://docs.stripe.com/billing/subscriptions/webhooks),
[versions API](https://docs.stripe.com/upgrades).
