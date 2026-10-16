# Recette des files de domaines et limites de crawl (#661, #672, #670)

Les fixtures ne déclenchent aucune analyse de site réel et ne consomment aucun crédit.

## Java et MariaDB

- `mvn test` : bornes et configuration, types JSON stricts, transport SSRF/robots,
  budgets indépendants. `DomainCrawlerTest` découvre 66 pages dont une à profondeur 5
  sur une fixture contrôlée avec une configuration 200/5 ; un snapshot falsifié à
  200/5 reste limité à 50/3 avec la configuration historique.
- `mvn -Duser.timezone=UTC -P mariadb-integration
  -Dit.test=DiscoveryIT,BatchIT,AuditClaimIT,ReportSharingMigrationIT,ConnectedModelIT verify`
  avec les variables de fixtures décrites dans [MariaDB](mariadb.md).
- Cas couverts : deux soumissions concurrentes et replay, plafonds globaux/compte/hôte,
  une découverte RUNNING par compte, rotation des comptes, reprise sans navigateur,
  annulation indépendante, réservation de plusieurs lots, refus de sur-réservation,
  rollback complet à saturation, isolation des comptes, upgrade V29/V30 et redémarrage
  sans perte des tâches existantes.
- Sous Windows, utiliser `lower_case_table_names=2` sur la base jetable pour que les
  migrations historiques retrouvent leurs noms de tables. La recette locale utilise
  MariaDB 11.4.5 sur loopback ; les binaires et données sont dans `outputs/test-tools/`
  (ignorés par Git). Aucun service Windows n'est installé.

## Frontend et revue visuelle

`npm test`, `npm run lint`, `npm run build` depuis `apps/console-web`.
Les tests de composants vérifient notamment les maxima dynamiques 200/5, la soumission
malgré un autre domaine en attente et la sélection complète au-delà de 100 URL.
Les tests existants d'accès au partage et d'export PDF restent applicables.

Pour reproduire la revue locale : démarrer `scripts/e2e/report-fidelity-fixture.mjs`
avec `REPORT_FIXTURE_PORT=3069`, puis le frontend avec `API_BASE=http://127.0.0.1:3069`
(sur le port 3048 dans la recette). Exécuter
`CONNECTED_BASE_URL=http://127.0.0.1:3048 node scripts/e2e/domain-queue-crawl-actions.mjs`.
Le script utilise Playwright du service existant ; `CLARTE_BROWSER_PATH` peut désigner
Edge/Chrome. `ARGOS_BROWSER_MODULES` permet d'utiliser le runtime fourni par Codex.

Contrôles effectués sur données fictives : 1200 px et 390 px en FR/EN et clair/sombre,
768 px FR sombre, 320 px EN clair. Partage et PDF : icônes
masquées aux lecteurs d'écran, hauteur mesurée identique de 44 px, focus visible,
ouverture au clavier, menus sans débordement. Formulaire : 200/5 autorisés,
201 refusé par le champ, nouvelle soumission disponible avec deux tâches en attente.
Captures locales et mesures : `outputs/ui-review/661-670-672/` (ignorées par Git).
Cette revue ne constitue pas une certification d'accessibilité ni un test de charge
sur le matériel de production.

Résultats locaux du 16 octobre 2026 : 894 tests frontend réussis, 41 tests
MariaDB réussis, 878 tests unitaires Java (877 réussis, 1 ignoré), build frontend
réussi. Lint : aucune erreur, un avertissement préexistant dans ReportPriorityList.
