# F08 — Synthèses privées des domaines

Implémentation de #556, sur le socle F07 / PR #569. Exigences FUN-04, FUN-05, QA-06, QA-07, QA-17. Le raccordement des écrans appartient à F09.

## Lectures livrées

- `GET /api/account/domains` : recherche `query` sur le hostname, dernière tentative par site privé, compteurs. Inclut les sites sans lot avec compteurs nuls et `latestBatchId: null`.
- `GET /api/account/domains/{domainId}/batches` : historique léger `BatchHistoryItem`, ordre date puis identifiant décroissants.
- `GET /api/account/domains/{domainId}/batches/{id}` : synthèse de la sélection complète, problèmes communs, cinq pages prioritaires, cinq pages incomplètes et métadonnées de découverte.
- `GET /api/account/domains/{domainId}/batches/{id}/pages` : pages du lot, avec `ruleKey`, `definitionVersion`, `severity`, `status`, `completeness`, `scope`, `query`, `sort`, `limit`, `offset`.

Toutes ces lectures exigent un compte vérifié, vérifient la propriété côté serveur et portent `Cache-Control: private, no-store`. Aucun jeton de rapport, HTML, preuve brute ou identité utilisateur ne figure dans ces projections. Le détail privé se consulte avec `runId` via le diagnostic F03. Le BFF refuse les paramètres inconnus, répétés, hors bornes et les identifiants hors BIGINT.

`scope=problematic` correspond aux pages ayant au moins un constat critique ou important. `scope=incomplete` retient les pages terminales incomplètes, en échec, annulées ou dont les données ne sont plus consultables. Les pages actives restent accessibles par `status`. `sort=priority` classe critiques décroissants, importants décroissants, URL puis identifiant ; `sort=url` classe URL puis identifiant. Les filtres sont conjoints ; règle, version et sévérité doivent correspondre au même constat. Les agrégats couvrent toujours tout le lot, et le filtrage précède la pagination.

## Définition des compteurs

La fixture Atelier Nova produit 8 retenues, 6 complètes, 1 partielle, 1 échec et 5 pages prioritaires. Les problèmes communs sont CSP 6/7, images 4/7, labels 3/7. Le problème critique de `/collections` reste individuel. Aucun score moyen de domaine n’est calculé.

Un problème commun exige deux pages affectées, une même clé stable et une même définition. Une page ne compte qu’une fois, quel que soit le nombre d’occurrences. La définition V1 empreinte la méthode de scoring, son fingerprint, la version de couverture, le domaine, le module et le poids. Une modification de méthode sépare les groupes ; aucun rapprochement par titre n’est effectué.

Le dénominateur compte uniquement les observations prouvées PASS/FAIL. Le moteur produit aussi WARN : un WARN mesuré, associé à un constat publié, devient un échec de règle dans cette projection, sans modifier sa sévérité (notamment INFO pour CSP). INFO seul, absence de résultat, indisponibilité, anti-bot et non-applicabilité ne deviennent jamais PASS. Les exclusions et leur nombre sont renvoyés pour chaque règle. Les titres/actions proviennent du rapport figé et sont bornés et nettoyés ; `titleKey` conserve l’identifiant de règle, sans promettre une traduction client inexistante.

`unknownPages` complète la partition d’exécution pour les runs terminés sans métadonnées de complétude. Les comptes critiques/importants et scores sont null lorsque leur preuve est inconnue ; zéro reste une valeur mesurée. `usage` porte les crédits du lot (réservés/comptés/libérés), les quotas globaux restant disponibles par `/usage`. Les échecs exposent le code sûr `ANALYSIS_FAILED`, sans relayer le message brut du moteur.

## Stockage, cohérence et coût

V24 ajoute `diagnostic_json`, `critical_count` et `important_count` à `ARG_AUDIT_REPORT`, avec mapping entité/QueryDSL. Cette projection compacte V1 est écrite dans la transaction de publication du rapport, du run terminé, de sa complétude et de ses crédits. Elle ne change ni le scoring ni le rapport public.

Le backfill V24 traite vingt rapports à la fois, depuis les rapports et scores internes figés, sans solliciter le catalogue actuel. Il supporte une reprise après DDL partiel et ne remplace pas une projection déjà présente. Les anciens rapports sans métadonnées fiables restent inconnus. La logique `DiagnosticProjection.from` constitue le format V1 : une évolution incompatible doit créer une nouvelle version et préserver le lecteur/backfill V1.

Les listes paginent d’abord les parents privés puis lisent les métadonnées des enfants en une requête groupée, sans JSON de rapport ni de diagnostic. Le nombre de requêtes est constant, pas proportionnel au nombre de lots. Les détails chargent au plus 50 projections compactes (256 règles maximum chacune), jamais les rapports bruts. La lecture des listes utilise un snapshot SQL répétable ; le détail reprend l’ordre de verrouillage F07 et réconcilie le statut/version avant lecture.

La projection suit la rétention du rapport. Un rapport expiré est immédiatement exclu des preuves, même avant sa purge physique. Les métadonnées d’exécution F07 et les crédits restent conservés : une ancienne analyse complète n’est pas reclassée en échec, mais ses constats/score ne sont plus présentés comme disponibles. Le client utilise `snapshotAt` pour dater la lecture ; `version` reste la version d’exécution F07, pas un ETag de rétention.

## Vérifications

- `DomainSummaryProjectionTest` : fixture versionnée, déduplication, tri, dénominateurs, indisponibilité, définition incompatible, données inconnues, expiration et filtres.
- `BatchIT` : publication réelle puis synthèse MariaDB, quotas, ownership sur hostname partagé, dernière tentative, historique, filtre avant pagination, rétention ; endpoints HTTP privés et absence de jetons ; nombre de requêtes constant et absence de chargement JSON dans les listes.
- `DiagnosticMigrationIT` : V23 vers V24, données historiques inconnues, backfill figé, reprise DDL et rejeu sans recalcul.
- Tests des contrats Java/TypeScript, BFF et filtres ; suites Java/frontend, lint, build et CI MariaDB.

La recette visuelle de l’interface domaine et la connexion des actions de la maquette restent suivies par F09 (#557).
