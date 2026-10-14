# Consommation et quotas F05

Lot [#555](https://github.com/dokor/argos/issues/555), UI-11, FUN-07, QA-09 et
QA-11. F05 livre la page et les primitives de comptage ; F06/F07 restent
responsables de la découverte, de l'admission HTTP et de l'orchestration des domaines.

## Écran livré

`/account/usage` et `/en/account/usage` reprennent le shell Clarté et son footer.
Le bloc principal affiche offre effective, disponible, plafond, analyses
comptées, réservations actives, mois et date de remise à zéro avec fuseau.
Le panneau latéral explique l'unité de crédit, les échecs, reprises et
annulations ; le lien de contact utilise `/feedback`. Aucun tarif ni paiement
n'est inventé. Un plafond nul et l'absence de plafond ont des états distincts.

Le journal montre date, URL, référence du run, référence de lot si présente,
état et effet sur les crédits. Les IDs restent des chaînes opaques, y compris
au-delà de la précision des nombres JavaScript. Le lien ouvre le diagnostic
du run ; les références de lot restent textuelles jusqu'aux écrans F07/F08.
Le mois et l'offset sont dans l'URL et conservés au changement de langue.
Un filtre historique ne modifie jamais le quota courant du cadre.

Chargement, liste vide, page hors limites, filtres invalides, panne de lecture,
quota indisponible, zéro, plafond atteint, illimité, compte non vérifié et
session expirée ont leurs propres états. Une panne ne devient pas un compteur
zéro. L'actualisation est explicite ; aucun polling permanent n'est ajouté.
Les réponses tardives sont ignorées, les requêtes interrompues au démontage,
et la révocation retire les données privées.

## Contrat et registre

`GET /api/account/usage` renvoie `Usage`, dont `available` calculé côté serveur.
`GET /api/account/usage/events` exige un compte vérifié et ne renouvelle pas
son activité. Paramètres : `period` YYYY-MM (défaut mois serveur), `limit`
1..100 (défaut 20), `offset` entier sûr >=0 (défaut 0). Le BFF rejette les
paramètres inconnus ou répétés, notamment tout propriétaire fourni. Réponses
privées no-store, paginées et filtrées par propriétaire avant pagination.

Le journal est une projection de l'état courant de l'unique ligne par run de
`ARG_USAGE_RUN`, pas un journal append-only de toutes ses transitions.
`COUNTED` appartient au mois de publication ; `RESERVED` garde son mois
d'admission ; `RELEASED` conserve cette période. Le journal courant comprend
aussi les réservations anciennes encore actives, comme le compteur courant.
Chaque entrée expose `createdAt`, `countedAt`, `releasedAt` nullable et l'URL
normalisée issue de l'audit privé. Une date de libération historique inconnue
reste explicitement inconnue. `batchId` vient de la relation possédée
`ARG_DOMAIN_BATCH_PAGE`, sans second registre ni duplication de compteur.

## Transactions et raccordement F07

`UsageService.admitMany(owner,N,connection)` vérifie toute la capacité sous
verrou, pour 1..100 enfants. F07 doit appeler cette primitive avant de créer
les enfants et leurs réservations **sur la même connexion et transaction**.
Elle n'insère aucun lot ni enfant elle-même. Un échec d'insertion annule tout ;
les appels concurrents ne peuvent pas dépasser la capacité disponible.
L'admission relit l'offre du compte puis le plafond individuel sous verrou,
y compris après une photographie Repeatable Read antérieure. Le disponible
est saturé à zéro et la configuration refuse les plafonds hors précision JS.

`AuditRunDao.requestCancellation(runId,owner,connection,now)` vérifie le
propriétaire sous verrou. QUEUED devient CANCELED et libère la réservation
dans la transaction ; RUNNING porte la demande, avec réservation conservée
jusqu'à sa fin effective. La publication verrouille le même run : soit le
rapport et son unique débit gagnent, soit l'annulation devient terminale sans
rapport puis `RunCanceledException` est levée **après commit**. Un échec/reaper
observe la demande et termine l'annulation sans remettre le run en file.
Une reprise normale garde la réservation ; un worker obsolète ne peut pas
libérer le run courant. Un débit tardif ne ressuscite pas une ligne RELEASED.
Les rapports déjà publiés restent comptés. L'annulation n'interrompt pas
immédiatement un module réseau déjà en cours.

F07 doit raccorder cette primitive à la mutation authentifiée du lot et
l'appliquer à ses enfants. **F05 n'active ni endpoint de domaine, ni bouton
d'annulation utilisateur, ni intégration CI/API.** Les lectures privées de
run comprennent CANCELED et arrêtent leur polling dans cet état terminal.

## Migration et recette

V21 ajoute le drapeau d'annulation et la date de libération, avec beans et
compagnons QueryDSL mis à jour. Les données de recette sont synthétiques ;
aucun plafond commercial chiffré n'est ajouté en configuration applicative.

- `mvn test` : compilation et tests unitaires Java.
- CI MariaDB : `UsageIT`, `AccountLifecycleIT`, `ConnectedModelIT` ; N atomique,
  rollback, concurrence, plafonds zéro/illimité, changement d'offre, changement
  de mois, publication/annulation, reprise, propriété et pagination privées.
- Frontend : tests DOM, BFF, typecheck, lint et build.
- `node scripts/e2e/connected-usage.mjs` contre un build local : FR/EN,
  clair/sombre, 320/390/768/1056/1440, journal, pagination et mois historique ;
  états supplémentaires à 320/1440, texte 200 %, axe, footer et débordement.
  Réponses de transport synthétiques, distinctes des tests SQL réels.
- Captures et bilan dans `outputs/ui-review/clarte-usage/`, artefact CI
  `connected-usage-{sha}`. La PR consigne les résultats au commit livré.
- `apps/console-web/scripts/check-usage.mjs` est adapté à l'écran ; il exige
  AccountBrowserFixture et MariaDB et n'est pas exécuté localement ici.

Aucune fusion, migration de production ou déploiement ne fait partie du lot.
