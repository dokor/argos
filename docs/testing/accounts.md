# Recette des comptes, sites, quotas et retours

Cette procédure regroupe les recettes des jalons comptes, sites, consommation,
historique, administration et feedback. Les résultats datés des 11 octobre 2026
restent dans l'historique Git et les PR ; une recette nouvelle doit préciser son
SHA et ses résultats sans recopier les anciens nombres de tests.

## Préparer l'environnement isolé

1. Préparer les schémas jetables et les variables `ARGOS_TEST_*` de
   [MariaDB](mariadb.md). MariaDB et JVM doivent être en UTC. Les fixtures refusent
   les destinations non locales et réinitialisent les bases : ne pas exécuter
   ces tests en même temps que la recette navigateur sur le même schéma.
2. Depuis `apps/api-backend`, lancer les suites puis préparer le classpath :

```sh
mvn -Duser.timezone=UTC test
mvn -Duser.timezone=UTC -P mariadb-integration verify
mvn -Duser.timezone=UTC test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=account-classpath.txt
```

3. Démarrer `com.dokor.argos.services.domain.report.AccountBrowserFixture` avec
   le classpath tests + classes + dépendances et les options JVM
   `-Duser.timezone=UTC -Dargos.account.browser.fixture=true`. Elle écoute
   uniquement sur `127.0.0.1:33317` et capture les emails localement. Les routes
   `/__test/*` et les comptes synthétiques sont absents du JAR de production.
4. Pour Next, définir `API_BASE=http://127.0.0.1:33317` et
   `ACCOUNT_ORIGIN=http://localhost:3000`, compiler puis démarrer sur le port 3000.
   Installer les dépendances frontend et playwright-service. Les quatre scripts
   `apps/console-web/scripts/check-*.mjs` importent Playwright depuis le frontend :
   y installer temporairement `npm install --no-save --package-lock=false playwright`
   si nécessaire. Le script feedback utilise playwright-service, ou
   `ARGOS_PLAYWRIGHT_ENTRY` pour une installation existante.
   `ARGOS_BROWSER_EXECUTABLE` peut désigner un Chromium/Edge local.
   Ne pas modifier les lockfiles pour une recette temporaire.
5. Exécuter les scripts depuis la racine, puis arrêter serveurs et base de fixture.

## Choisir la recette

| Sujet | Commande navigateur | Options JVM supplémentaires de la fixture | Contrôles essentiels |
| --- | --- | --- | --- |
| Comptes | `node apps/console-web/scripts/check-accounts.mjs` | aucune | Inscription, vérification email POST, retour rapport, claim, révocation, archivage, lien partagé conservé/expiré |
| Sites | `node apps/console-web/scripts/check-sites.mjs` | aucune | Ajout sans audit, deux URL, hostname refusé, deux propriétaires, rattachement, session et dernière tentative/dernier rapport distincts |
| Consommation | `node apps/console-web/scripts/check-usage.mjs` | `-Dargos.usage.fixture-limit=2` | Deux réservations, refus 429, débit unique après publication, libération après échec, claim rejoué |
| Administration | `node apps/console-web/scripts/check-admin.mjs` | `-Dargos.admin.browser.fixture=true` | Refus non-admin, filtres/pagination, plafond zéro, admission refusée, restauration, rapport et journal |
| Feedback | `node scripts/e2e/feedback.mjs` | `-Dargos.admin.browser.fixture=true -Dargos.feedback.browser.fixture=true` | Bug/suggestion/faux positif, référence autorisée, statut concurrent, journal, rapport inchangé |
| Historique | `node scripts/e2e/account-history.mjs` | aucune ; réponses API simulées par ce script | Pagination, courbes interrompues, relance, révocation, FR/EN, clavier, axe |

`AccountLifecycleIT` et `UsageIT` couvrent les transactions réelles : isolation
compte/URL/curseur, migrations V11–V16, concurrence et rollback, quota, expiration,
archivage et purge feedback. Pour un passage ciblé :

```sh
mvn -Duser.timezone=UTC -P mariadb-integration -Dit.test=AccountLifecycleIT,UsageIT verify
```

## Limites et preuves

Les recettes comptes/sites/usage/admin/feedback traversent Next, Java et MariaDB
réels. Les rapports publiés sont synthétiques ; elles ne prouvent pas les moteurs
distants. Le script historique simule les API ; ses assertions visuelles ne
remplacent pas les tests SQL. Couvrir FR/EN, clair/sombre, mobile, texte à 200 %,
focus, noindex et effacement des données privées après révocation. Les contrôles
automatisés ne remplacent ni lecteur d'écran ni recette humaine.

Les sorties restent sous `outputs/` et dans les artefacts CI. Vérifier les chemins
indiqués par chaque script. Consigner commandes, SHA, environnement, limites et
échecs dans la PR. Les applications OAuth/SMTP réelles, HTTPS déployé, charge
Argon2, migrations sur volume représentatif et revue indépendante restent des
prérequis distincts de [mise en service](../accounts/operations.md).
