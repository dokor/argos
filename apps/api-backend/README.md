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

`db.QuerydslGenerator` est un outil de développement conservé, pas du code mort :
son `main` est lancé explicitement depuis l'IDE. Il écrit dans
`apps/api-backend/src/main/java` relativement à la racine du dépôt. Ne pas le lancer
pour une migration courante : il pourrait écraser les adaptations existantes.
Le profil `querydsl-code-generation` ne constitue pas encore une séparation du
classpath runtime ; voir l'[inventaire de maintenance](../../docs/maintenance.md).

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
