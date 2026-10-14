# Administration F11 — #559

## Parcours livré

UI-12 : `/account/admin/users`, `/account/admin/users/[id]` et variantes EN.
La racine `/account/admin` redirige vers la liste ; le suivi technique reste
sur `/account/admin/runs`, les retours et statistiques gardent leurs routes.
Liste de comptes avec recherche nom/e-mail, état et offre configurée, usage
consommé/réservé, pagination par curseur. Filtres dans l’URL ; détail par ID
chaîne, retour filtré et changement de langue. Footer Clarté dans tous les états.

Fiche : identité, rôle distinct de l’offre, consommation/période/renouvellement,
plafond individuel ou hérité. Une confirmation affiche avant/après, motif issu
du catalogue et case explicite. Si nécessaire, réauthentification existante
par mot de passe ou code e-mail, sans perdre le changement préparé. Un 409
impose de fermer et recharger, sans actualiser silencieusement expectedVersion.
Le journal par compte et le journal global sont paginés et conservent 90 jours.

## Autorisation et transaction

FUN-08, QA-03, QA-13 : session ACTIVE vérifiée, rôle ADMIN relu côté serveur,
CSRF, authentification récente, confirmation et motif contrôlé. Aucun endpoint
ne modifie le rôle ni ne permet l’impersonation. Le serveur fournit les capacités
d’édition affichées ; elles ne remplacent jamais ses contrôles de mutation.
Un administrateur peut modifier sa propre offre, pas celle d’un autre ADMIN.
Aucun ADMIN ne peut être suspendu, y compris soi-même. ARCHIVED est immuable.

V26 ajoute `admin_version`, `suspended_from` et les champs de journal
état avant/après, motif et identifiant de requête. Entités et Q* accompagnent
la migration. Les événements anciens restent lisibles avec ces champs NULL :
aucun motif ni état historique n’est inventé. Les nouveaux événements sont
complets. Le journal contient seulement des IDs et valeurs contrôlées, aucun
texte libre, e-mail, secret ou rapport.

Les mutations prennent les verrous acteur → cible → consommation. La version
est comparée sous verrou ; chaque mutation effective l’incrémente, un changement
identique avec la version courante n’ajoute aucun événement. Une ancienne version
renvoie 409, y compris après une première soumission réussie.
L’offre effective proposée (plafond individuel, sinon configuration de l’offre)
est refusée avec 409 `quota_below_committed` si elle est inférieure à
`used + reserved`, y compris une baisse obtenue en retirant une surcharge.
Usage et publication utilisent le même verrou de consommation. Journal,
version, offre/plafond ou état et révocations sont atomiques ; une erreur du
journal annule toute la transaction.

La suspension conserve l’état ACTIVE/PENDING précédent, révoque toutes les
sessions et invalide les jetons compte ainsi que les transactions OAuth de
liaison. Les sessions, login mot de passe/OAuth, renouvellement, consommation
de jetons et nouvelles admissions refusent SUSPENDED. La reprise restaure
l’état précédent sans session automatique ni réactivation des anciens jetons.
Les jobs déjà admis, réservations, rapports et publications continuent.

## Contrats et lectures

OpenAPI et types générés reflètent les routes existantes renforcées. Les listes
admin réutilisent `q`, `state`, `offer`, `limit`, `cursor` et `{items,nextCursor}`
plutôt que le prototype offset/query. `/entitlement-options` décrit offres,
plafonds configurés et motifs. `/users/{id}/events` et `/events?target=…`
partagent le même journal ; toutes les lectures sont privées/no-store.
Les réponses de mutation sont `{changed,version}` ; la fiche est ensuite relue.
Les requêtes et corps sont validés au BFF et à la ressource Java. Les lectures
de comptes chargent l’usage d’une page en une requête groupée, sans N+1 ni
verrou de compte croisé entre administrateurs. Les IDs restent des chaînes.

## Recette et preuves

- `AccountLifecycleIT` : autorisations HTTP, CSRF, réauth, champs stricts,
  version, deux administrateurs concurrents, admission concurrente, quota,
  journal atomique, suspension/reprise, révocation et état PENDING préservé.
- Tests BFF et composants : ID BIGINT, routes/retours, raison contrôlée,
  confirmation, réauth, double soumission, conflit sans écrasement.
- `admin-browser.mjs` dans ControlledAuditE2eIT : navigateur → BFF → Jersey →
  MariaDB ; réauth réelle, quota avant/après, deux refus 409 sans événement,
  suspension/reprise, anciennes sessions toujours révoquées, usage intact.
- `connected-admin.mjs` : fixtures explicitement synthétiques, FR/EN,
  clair/sombre, 320/390/768/1056/1440, liste/détail/confirmation, états
  vide/erreur/refus/stale, zéro/illimité/archivé, focus et Escape.

Captures locales et compte rendu dans `outputs/ui-review/clarte-admin/`,
ignorés par Git ; artefact CI `connected-admin-<sha>`, avec `real/proof.json`
et `real/detail.png`. Le scanner axe ne constitue pas une certification WCAG.

Écarts assumés à la maquette : motif en liste contrôlée au lieu de texte libre ;
aucun total global dérivé d’une page de résultats ; consommés et réservés séparés ;
configurations commerciales réelles uniquement. Les travaux multi-clients,
équipes, paiement, API/CI et suppression de comptes par un admin restent exclus.
Aucune fusion, remise à zéro de données ou mise en production dans ce lot.
