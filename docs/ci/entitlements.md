# CI Premium — droits et consommation

Premier lot de l'epic [#731](https://github.com/dokor/argos/issues/731),
contrat [#732](https://github.com/dokor/argos/issues/732). **Accès fermé par
défaut.** Ce lot fournit la politique et la barrière Java transactionnelle ;
il ne livre aucune route machine, clé API ou souscription commerciale.

## Matrice validée le 18 octobre 2026

| Capacité | FREE | PREMIUM avec droit `ci_access` | CI interne |
| --- | --- | --- | --- |
| API CI client | Non | Compte ACTIVE (email vérifié), droit actif non expiré, clé valide avec portée autorisée | Non |
| Analyses CI par mois | Aucune | 30 par clé logique ; 3 clés incluses | Auto-audit interne existant, hors API client |
| Clés | Aucune | 3 emplacements d'intégration ; rotation sans remise à zéro | Aucune clé client accordée par cette offre |
| Domaines vérifiés | Aucun pour la CI | Illimités ; preuve toujours obligatoire | Cible fixe de l'auto-audit existant |
| Audits CI simultanés | Aucun | 1 par compte, toutes clés confondues | Infrastructure interne existante |
| Durée maximale d'une clé | Sans objet | Un an calendaire UTC après création | Sans objet |
| Permissions machine | Aucune | Lancer, lire les résultats de son intégration, lire sa consommation, selon scopes | Aucune permission client implicite |

Le rôle USER/ADMIN est indépendant de cette matrice. L'offre PREMIUM seule
n'atteste pas un paiement. `ARG_ACCOUNT_CI_ENTITLEMENT` contient le droit
serveur explicite `ci_access` et sa date limite exclusive `valid_until`.
L'absence de ligne, un droit faux ou expiré refuse les nouvelles opérations.
V40 ne crée aucun droit pour les comptes existants. Le lot facturation #733
écrira cette projection après confirmation authentifiée de l'état fournisseur ;
aucun paramètre navigateur, redirection de paiement ou corps API ne l'accorde.
Le fournisseur, les prix, les taxes et les règles de renouvellement commercial
restent à décider. L'échéance du droit n'est pas l'expiration de la clé.

« Par clé » désigne un emplacement d'intégration stable, conservé lors d'une
rotation, révocation ou remplacement. Un nouveau secret ne redonne pas 30
analyses. Réutiliser un emplacement conserve ses débits du mois et ses
réservations. Trois emplacements permettent au plus 90 analyses mensuelles
si chacun utilise ses 30 analyses ; les crédits ne sont pas transférés entre
emplacements. Le chevauchement temporaire des secrets d'une rotation ne crée
pas de quatrième emplacement ni de quota supplémentaire (#462/#735).

La concurrence 1 concerne l'exécution CI du compte ; la double mesure réserve
deux analyses ensemble puis les exécute en séquence (#735/#466). Domaines
illimités ne signifie ni requêtes de vérification ni ressources illimitées :
les limites anti-abus, budgets réseau et contrôles SSRF restent obligatoires.

## Politique et branchement serveur

Les valeurs approuvées sont dans `reference.conf`, avec
`premium-ci.enabled=false`. Une configuration externe peut les remplacer.
Activer sans matrice complète ou avec un nombre nul, négatif, fractionnaire
ou hors plage fait échouer le démarrage via `CiPolicy`, liée en singleton
immédiat. `max-verified-targets=null` est la déclaration explicite de
l'absence de plafond de domaines ; une propriété manquante n'en tient pas lieu.

`CiEntitlementService` n'authentifie personne. Après résolution côté serveur
du propriétaire par un credential autorisé, les lots suivants doivent :

1. Créer une clé (#462) : authentifier la session vérifiée, CSRF et
   réauthentification récente, puis appeler `requireNewAccess(owner, c)` et
   insérer la clé dans la **même transaction**. Appliquer les plafonds de clés,
   la preuve de domaine et la durée maximale ; le secret n'est montré qu'une fois.
2. Admettre un nouveau run (#463/#735) : authentifier la clé et ses scopes,
   retrouver d'abord une admission idempotente existante, puis appeler
   `admitMany(owner, 1 ou 2, c)` avant toute insertion. Contrôler également le
   quota de l'emplacement, la concurrence et la cible. Insérer tous les runs
   et leurs réservations via le moteur existant sur **cette connexion**.
   Tout refus ou échec annule la transaction complète.
3. Consulter un résultat existant : authentifier le credential courant et
   sa portée/propriété ; ne pas réappliquer le droit de nouvelle admission.
   Un compte inaccessible ou une clé expirée/révoquée reste refusé. Aucun
   nouveau secret n'est accordé par cette exception de consultation.

Le verrou courant compte → droit est conservé jusqu'au commit. Les futures
écritures de souscription prennent les mêmes verrous dans cet ordre. Si le
changement termine d'abord, l'admission voit les droits nouveaux même après
une ancienne lecture MVCC. Si l'admission termine d'abord, les runs admis
restent acquis. L'autocommit est rejeté. Publication/échec ne doivent jamais
appeler cette barrière ni prendre ces verrous après un verrou de run.

Ce lot rend les limites disponibles ; leur application aux clés, domaines,
concurrence et quota d'emplacement relève de #462/#734/#735. Il ne faut pas
ouvrir l'accès en activant ce drapeau avant la recette complète #467.

## Un seul registre de consommation

Le [contrat mensuel existant](../accounts/usage-contract.md) reste l'autorité :
mois calendaire de publication dans `usage.timezone` (UTC par défaut), un
rapport même partiel = un débit, échec définitif sans rapport = libération.
Les réservations en cours survivent à la frontière mensuelle. Lecture,
reprise de transport, reprise du worker, idempotence et publication d'issues
GitHub/GitLab ne consomment aucune analyse supplémentaire.

Le lot #735 rattachera l'emplacement stable aux runs du registre existant
`ARG_USAGE_RUN`, sans second compteur divergent. Il appliquera les 30 analyses
par clé dans la même transaction que les réservations, en plus des éventuels
plafonds de compte déjà configurés. Ce premier lot ne change aucun plafond des
audits navigateur existants. La double mesure coûte deux analyses : avec un
seul crédit restant, aucun des deux runs ne doit être créé.

Un downgrade ne supprime ni compte, rapports, débits ni réservations et ne
réactive jamais un credential révoqué/expiré. Les clés seront gérées par #462 ;
ce lot ne prétend pas encore valider leur cycle de vie. L'audit gratuit reste
un parcours séparé, protégé par ses contrôles actuels. Un appel CI refusé
n'est jamais transformé en audit anonyme.

## Refus et autonomie

Les décisions internes de la barrière ne sont pas des réponses HTTP : #741
définira leur traduction commune. Pour un credential machine, un compte
inaccessible rejoint le refus d'authentification uniforme. Un droit CI non
disponible après authentification valide permet une action de consultation
de l'offre dans son propre compte, sans motif de paiement supposé ni promesse
de réactivation. Un quota atteint renvoie la consommation et l'échéance
connues autorisées, sans retry automatique jusqu'au mois suivant.

L'utilisateur doit pouvoir récupérer une admission ambiguë avec la même clé
d'idempotence, consulter ses résultats et reprendre uniquement la publication
des tickets. Aucun diagnostic ne recommande un token admin, un repli anonyme
ou la désactivation de TLS/SSRF. Une échéance commerciale non connue reste
inconnue ; aucun remboursement n'est annoncé sans confirmation.

## Vérification

`CiPolicyTest` vérifie la fermeture par défaut, les valeurs approuvées,
les configurations invalides et l'année bissextile. `CiEntitlementServiceTest`
vérifie l'exigence de transaction et la cardinalité des mesures.
`CiEntitlementIT`, exécuté dans le job MariaDB existant, traverse V40 et ses
mappings, la matrice offre/rôle/état/droit, la lecture courante après downgrade,
la réservation double atomique et la frontière mensuelle. `UsageIT` conserve
la preuve de publication/libération, rollback et absence de double débit.
Ces fixtures ne sont pas une recette de souscription réelle ou de charge.
