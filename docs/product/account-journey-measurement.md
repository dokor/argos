# Parcours compte — #484, #485, #486

Le 17 octobre 2026, extension de la collecte interne de #42, après lecture de son plan, de son implémentation et de #483. Responsable : opérateur Argos. Aucun fournisseur, abonnement, activation de production ou historique reconstitué.

## Collecte et confidentialité

Les drapeaux BFF PRODUCT_ANALYTICS_ENABLED et backend product-analytics.enabled, le credential serveur ADMIN_API_TOKEN et le réglage durable ARG_PRODUCT_SETTING restent nécessaires. Les écritures de mesure prennent le même verrou que la désactivation. Aucun changement de réglage n’est effectué par cette livraison.

Le consentement de session est renouvelé avec argos_product_consent_v2 : un ancien accord ne vaut pas pour les cohortes de compte. Cookie HttpOnly, Secure en production, SameSite Lax afin de recevoir le choix lors du callback OAuth. Les mutations de consentement restent protégées par l’origine ; celles du compte gardent origine, CSRF et contrôles de propriété. Refus/retrait ou absence d’accord : aucun nouveau fait de compte collecté. Le credential de mesure est construit uniquement dans le BFF, jamais copié depuis le navigateur.

Les références internes de compte, session et analyse restent dans ARG_PRODUCT_ACCOUNT_EVENT pour l’unicité et les cohortes. Ce sont des données pseudonymes, pas anonymes. Aucune référence n’est exposée dans les API de mesure, les compteurs publics ou les logs. Aucun token ou hash de token, URL brute, email, nom, IP, subject OAuth, preuve de rattachement ou contenu privé n’entre dans les faits de mesure. Les appels fonctionnels conservent naturellement les informations nécessaires à l’authentification et aux rapports, sans les dupliquer dans la collecte. La notice et le texte du consentement FR/EN expliquent cette extension.

Les faits sont purgés après 90 jours par la tâche horaire existante, sans effacer compte, audit, run ou rapport. La suppression physique d’un compte supprime ses faits par clé étrangère. Le retrait empêche les nouvelles observations ; les faits déjà consentis suivent leur échéance. Les agrégats ne prétendent pas couvrir les sauvegardes, qui suivent leur politique propre.

## Dictionnaire

| Événement | Déclencheur | Unicité interne | Dimensions exposées |
| --- | --- | --- | --- |
| account_registration_view | Formulaire d’inscription affiché après accord | Une fois par navigation dans la mémoire du composant, y compris StrictMode | Route statique /account/register, FR/EN, page |
| account_registered | Création réellement validée en base, classique ou sociale | Une fois par compte | password/google/github/linkedin, FR/EN |
| account_authenticated | Connexion classique ou callback social réussis | Une fois par session créée | Méthode et FR/EN |
| account_auth_rejected | Réponse de refus réelle de l’authentification via BFF | Une tentative, retry = nouvelle tentative | Route statique inscription/connexion, FR/EN, form, validation/service/rate_limit |
| report_claimed | Rattachement après validation du propriétaire et de la preuve | Une fois par run | FR/EN |
| account_activated | Première analyse acceptée depuis le compte ou premier rattachement | Une fois par compte | FR/EN |
| account_activity | Connexion réussie ou lecture réussie d’un profil vérifié | Une fois par compte et jour UTC | FR/EN |

L’inscription classique produit un compte PENDING : la vérification de l’adresse reste distincte du premier usage. Une réponse neutre pour un email déjà inscrit ne produit pas account_registered. Une association de méthode sociale ne crée ni inscription ni connexion mesurée. Un callback consommé ou échoué ne produit pas de succès. Les actualisations du profil ne multiplient pas les jours actifs ; les statuts de progression et renouvellements de session ne sont pas des activités. Une lecture du profil depuis la navigation publique compte : cette définition ne prouve ni une visite de l’espace personnel ni une interaction volontaire.

Les événements publics gardent leur allowlist fermée. Les erreurs détaillées, chemins privés, paramètres OAuth et identifiants ne deviennent jamais des dimensions. Toute panne de mesure est omise après l’opération métier ; aucune reprise historique n’est tentée. Une réponse perdue avant la mesure peut donc manquer, sans rejouer l’inscription ou l’analyse.

Les audits conservent la collecte existante (création, états, premier rapport affiché). L’audience visitor/account est figée à l’attribution initiale, d’après le propriétaire réel du run. Un rattachement ultérieur ne transforme pas un audit initialement sans compte en audit connecté. Les attributions historiques sont unknown et ne sont pas rétroqualifiées.

## Métriques et dénominateurs

Périodes administrateur : 7, 30 ou 90 jours, bornes UTC explicites. Cohorte de création dans [from, until[ ; les états observés ensuite restent limités à until. Les compteurs publics suivent leurs jours calendaires UTC, séparément.

| Mesure | Numérateur | Dénominateur et exclusions |
| --- | --- | --- |
| Activation | Comptes de la cohorte avec un premier usage après inscription et avant until | Inscriptions effectivement mesurées dans la période ; refus et pertes de collecte exclus, sans les assimiler à un abandon |
| Rattachement de la cohorte | Comptes inscrits dans la période ayant rattaché au moins un rapport depuis cette inscription | Même cohorte d’inscription ; plusieurs rapports ne multiplient pas les comptes |
| Rétention J+7 / J+30 | Comptes de la cohorte ayant une activité sur le jour UTC exact inscription +7 / +30 | Uniquement les inscriptions dont la totalité du jour cible est écoulée ; immatures affichés séparément ; zéro éligible = indisponible |
| Comptes actifs | Comptes distincts avec une première activité quotidienne dans la période | Effectif, sans division par les visiteurs ; chaque compte peut produire plusieurs jours actifs |
| Comptes revenus | Actifs de la période avec un jour d’activité mesuré antérieur | Effectif distinct, parmi les comptes actifs ; observation antérieure limitée aux 90 jours conservés |
| Connexions / rapports rattachés | Sessions / runs distincts dont le fait mesuré appartient à la période | Effectifs d’actions, distincts des comptes uniques et de la cohorte d’inscription |

L’activité peut concerner des comptes créés avant la période. Les comptes ne sont pas des personnes uniques. Une période de 7 jours n’a normalement pas de cohorte J+7 mature ; sélectionner 30 ou 90 jours permet d’observer les cohortes correspondantes. Une journée active est datée de sa première observation : une activité plus tardive le même jour ne déplace pas le fait dans une fenêtre glissante commençant au milieu de ce jour.

Aucun taux visite → inscription, aucune attribution individuelle audit anonyme → compte ni aucune causalité d’amélioration n’est calculé. Les lectures non consenties, blocages, pannes, retraits et purge réduisent la couverture. Aucune activité observée ne signifie pas abandon. Les premières séries devront être constituées après activation autorisée.

## Premium réservé

Contrats réservés premium_offer_view et premium_upgrade_completed, refusés par l’allowlist active et sans endpoint de succès. L’administration affiche leur indisponibilité. Un futur changement devra définir l’offre réellement disponible, le déclencheur métier vérifié, le consentement et les dénominateurs avant activation. Aucun prix, plafond ou achat fictif.

## Validation

Les résultats effectivement obtenus sont consignés dans [la recette de cette livraison](../qa/account-journey-484-486.md). Les scénarios incluent consentement renouvelé/refus/retrait, navigation et rerender, connexion sociale en erreur, panne de mesure, unicité SQL, frontière UTC de maturité, audience immuable, purge et affichage FR/EN des taux indisponibles.
