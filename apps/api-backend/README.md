# Backend API Argos

Java 21, Maven, Plume/Guice, Jersey/Grizzly, MariaDB et QueryDSL.
Les routes REST sont montées sous `/api`. `WebApplication` démarre la base,
les migrations Flyway, le serveur HTTP et le scheduler des audits.

## Démarrage local

Prérequis : JDK 21, Maven 3.9+, MariaDB avec une base de développement dédiée.
Depuis ce dossier, créer `local.conf` (ignoré par Git) :

```hocon
include classpath("application.conf")
db.hikari."dataSource.url" = "jdbc:mariadb://localhost/argos_dev"
db.hikari."dataSource.user" = "argos_dev"
# DB_PASSWORD et INTERNAL_API_PASSWORD sont lus par application.conf.
external.playwright.url = "http://localhost:3016"
external.lighthouse.url = "http://localhost:3017"
```

Fournir `DB_PASSWORD` et `INTERNAL_API_PASSWORD` dans l'environnement du processus
(ou via une configuration locale protégée). Ils sont obligatoires : le démarrage
échoue s'ils sont absents ou vides. Ne pas modifier le fichier versionné avec des
secrets. `ADMIN_API_TOKEN` est optionnel pour le démarrage, mais requis pour les
lectures admin historiques ; sa valeur doit correspondre à celle du BFF Next.

```sh
mvn package
java -Dconfig.file=local.conf -cp "target/dist/api-backend/lib/*" com.dokor.argos.WebApplication
```

Le résultat Maven est un JAR avec ses dépendances dans `target/dist/api-backend/lib`,
pas un fat JAR autonome. Le serveur écoute par défaut sur le port 8081 ;
`-Dhttp.port=...` et `-Dhttp.address=...` permettent de le configurer.
Le démarrage applique les migrations : utiliser une base jetable pour les essais.

## Configuration et services optionnels

- `src/main/resources/application.conf` : valeurs par défaut ; `-Dconfig.file`
  sélectionne le fichier externe, qui doit inclure ces valeurs si nécessaire.
- Les clients externes lisent les clés `external.*`, puis leurs variables
  d'environnement historiques et leurs valeurs par défaut. Voir
  [opérations ZAP/SSL](../../docs/analysis/zap-ssl-operations.md).
- Le scheduler prend un run à la fois ; les modules suivent
  l'[orchestration documentée](../../docs/analysis/progress.md). L'intervalle
  `audit.scheduler.interval` vaut 5 secondes après la fin du traitement précédent.
- Les comptes restent désactivés par défaut. Suivre la
  [configuration des comptes](../../docs/accounts/operations.md) pour JWT, SMTP,
  OAuth et origine autorisée.
- `AHREFS_API_KEY` active l'enrichissement Domain Rating des nouveaux rapports,
  mis en cache 24 h par domaine ; il n'affecte pas le score.
- La synthèse facultative est décrite dans le [guide du service](codex-summary/README.md).
  Son indisponibilité n'empêche pas la publication d'un rapport.

## Base de données

Préserver toutes les migrations historiques de `src/main/resources/db/migration`.
Pour une évolution, ajouter une migration et mettre à jour l'entité ainsi que la
classe `Q*` correspondantes dans `db.generated`.

Les entités et `Q*` restent maintenues manuellement après chaque nouvelle
migration. Aucune génération n'est exécutée par `mvn clean verify` ou `package`.

Le générateur de comparaison est dans `src/querydsl/java`, ajouté **aux sources
de test uniquement** par le profil `querydsl-code-generation`. Ce profil ajoute
`plume-db-querydsl-codegen` et ses transitifs en scope `test` ; ils ne sont inclus
ni dans le JAR applicatif ni dans `target/dist/api-backend/lib`, même si le profil
est actif. Guice utilise `jakarta.inject` ; `javax.inject` est un transitif du
codegen. Voir les preuves dans l'[inventaire de maintenance](../../docs/maintenance.md).

Depuis `apps/api-backend`, compilation et tests du seul outil :

```sh
mvn -Pquerydsl-code-generation -Dtest=QuerydslGeneratorTest test
```

Pour lancer explicitement la génération, préparer une **base MariaDB jetable**
avec le schéma à examiner (par exemple appliquer les migrations en démarrant le
backend sur cette base locale, puis l'arrêter). Fournir son URL et son utilisateur
explicitement ; le générateur ne lit pas `application.conf`/`config.file`, ne
lance pas Flyway et ne démarre pas le scheduler. Le mot de passe vient uniquement
de `QUERYDSL_DB_PASSWORD`, à fournir dans l'environnement du processus.

```sh
mvn -Pquerydsl-code-generation test-compile exec:java \
  -Dquerydsl.jdbc.url=jdbc:mariadb://127.0.0.1:3306/argos_querydsl_test \
  -Dquerydsl.jdbc.user=argos_fixture
```

Les classes sont écrites dans `target/querydsl-preview`, hors des sources
courantes. `-Dquerydsl.output=...` permet de choisir un autre dossier neuf/vide,
hors d'un répertoire `src`. Une sortie non vide est refusée ; conserver chaque
prévisualisation ou choisir un nouveau dossier pour relancer. Les erreurs de
connexion/génération font échouer la commande. Comparer les fichiers produits
aux entités maintenues ; ne pas les recopier automatiquement.

Dans IntelliJ, activer le profil et recharger Maven, puis lancer le `main` avec
trois arguments : URL JDBC, utilisateur, dossier de prévisualisation absolu.
La CI MariaDB exécute `bash scripts/querydsl-smoke.sh` sur son schéma dédié
`argos_querydsl_test` : démarrage du backend depuis le classpath distribué,
réponse HTTP authentifiée, prévisualisation et compilation des classes produites.
Les logs et la prévisualisation sont conservés avec les artefacts d'intégration.

## Tests et packaging

```sh
mvn test
mvn clean verify
```

`verify` exécute le packaging et génère `target/site/jacoco/`. Les classes QueryDSL
générées sont exclues de la couverture. Utiliser le résultat associé au SHA testé,
pas les pourcentages des anciens audits. Les tests nécessitant ZAP/MariaDB ont des
prérequis distincts : [CI](../../docs/testing/ci.md),
[MariaDB](../../docs/testing/mariadb.md), [E2E](../../docs/testing/controlled-e2e.md).

## Endpoints internes et exploitation

`/api/swagger` expose la définition OpenAPI. `/api/monitoring/info`,
`/api/monitoring/health` et `/api/monitoring/metrics` exposent le diagnostic interne.
Ils sont protégés par Basic Auth (`internal-api.auth-username` et
`INTERNAL_API_PASSWORD`). Ne pas figer une ancienne version du webjar Swagger UI
dans les liens d'exploitation.

Le déploiement est défini dans `.github/workflows/deploy-api-backend.yml` depuis
la racine du dépôt, et dans `infra/compose/api-backend/docker-compose.prod.yml`.
Voir le [runbook](../../infra/RUNBOOK.md) pour les opérations et sauvegardes.
