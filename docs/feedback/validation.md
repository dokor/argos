# Validation — retours privés, 11 octobre 2026

Milestone 11 / epic #460, implémentation depuis main `0791325` dans un worktree
isolé, branche `codex/milestone-11-feedback`. Le checkout initial est préservé.

| Issue | Livraison | Preuves exécutées |
|---|---|---|
| #33 | Suggestions dans le formulaire commun, confirmation, quotas, stockage privé | Java validation/stockage ; BFF CSRF/liste blanche ; DOM FR/EN ; navigateur réel |
| #34 | Bugs avec contexte de page et champs de reproduction facultatifs, sans contexte automatique | DOM conservation du texte après erreur ; BFF 503/429 ; HTTP quota persistant ; navigateur réel |
| #49 | Dépôt depuis un constat, référence vérifiée et explication, score immuable | Java/MariaDB : propriétaire, autre utilisateur, token partagé, expiration et clé forgée ; navigateur : rapport identique avant/après traitement |
| #461 | Liste filtrée/paginée, détail privé, statut et historique de traitement | HTTP 401/403 et révocation ; MariaDB filtre/pagination, 409, rollback du journal, purge en cascade ; BFF/DOM et navigateur FR/EN |

Résultats locaux :

- Java 21 : `mvn test`, **664 tests**, zéro échec/erreur, un test conditionnel
  ignoré (ZAP absent localement).
- MariaDB portable **11.4.9**, instance jetable sur 127.0.0.1:33331, JVM/base UTC :
  `mvn -Duser.timezone=UTC -P mariadb-integration -Dit.test=AccountLifecycleIT verify`,
  **44 tests**, zéro échec/erreur, aucun ignoré. La migration V16 et les entités
  QueryDSL sont réellement exercées. Maven package/verify réussis.
  Les quatre scénarios feedback ont été repassés après ajout du refus de
  référence personnelle pour un propriétaire devenu non vérifié.
- Frontend Node 24 / Next 16.3.8 : lint, build de production et suite Vitest,
  **358 tests / 53 fichiers**, zéro échec.
- `scripts/e2e/feedback.mjs` contre Next compilé, Java et MariaDB réels, sans
  interception des réponses applicatives : suggestion, bug, publication d’un
  rapport synthétique, faux positif, refus admin anonyme, connexion admin,
  filtre, détail, statut confirmé et trace. Comparaison exacte du rapport avant
  et après traitement. FR 1280 px clair et EN 360 px sombre, focus clavier
  visible, absence de débordement horizontal et d’erreurs JavaScript. Axe-core :
  zéro violation WCAG 2 A/AA et 2.1 AA sur les régions main du formulaire et de
  l’administration dans ces deux configurations ; captures finales inspectées.

La recette a révélé la réponse Fetch non consommée dans le formulaire : le
client lit désormais le JSON et exige `accepted: true` avant confirmation.
Un test verrouille le refus d’une confirmation sur un HTTP 200 vide. La revue
visuelle a corrigé les selects de filtres dont le fond natif était illisible
en thème sombre. Captures et résultats locaux ignorés sous
`outputs/feedback-browser/` ; logs sous `outputs/feedback-*.log`.

## Rejouer

1. Préparer une MariaDB locale jetable et les variables ARGOS_TEST_CREDENTIALS_*
   de [../testing/mariadb.md](../testing/mariadb.md), puis exécuter les commandes
   Java ci-dessus. Ne pas lancer les tests de reset pendant la recette navigateur.
2. Préparer le classpath de test (`dependency:build-classpath`), puis démarrer
   AccountBrowserFixture avec les flags `-Dargos.account.browser.fixture=true`,
   `-Dargos.admin.browser.fixture=true` et `-Dargos.feedback.browser.fixture=true`.
   Les endpoints `/__test/*` et comptes synthétiques restent exclusivement sur
   le classpath de test, sur 127.0.0.1:33317.
3. Compiler/démarrer Next sur localhost:3000 avec API_BASE=http://127.0.0.1:33317
   et ACCOUNT_ORIGIN=http://localhost:3000. Le script exige ces destinations
   locales. Installer les dépendances playwright-service pour Playwright ;
   ARGOS_PLAYWRIGHT_ENTRY peut désigner un `playwright/index.mjs` déjà installé.
   ARGOS_BROWSER_EXECUTABLE peut désigner Edge/Chromium local.
4. Depuis la racine : `node scripts/e2e/feedback.mjs`. Le script utilise axe-core
   fourni par les dépendances frontend pour vérifier les pages formulaire et
   administration (WCAG 2 A/AA, 2.1 AA).
5. Arrêter les serveurs et la base jetable après la recette.

Pas de recette humaine, de soumission au support externe, d’audit distant,
de configuration de production changée ou de déploiement revendiqué.
