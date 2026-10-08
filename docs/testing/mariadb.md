# MariaDB integration

Production uses MariaDB 11.4. The `MariaDB integration (11.4)` CI job runs the
Failsafe suites for report credentials, publication and claims, newsletter
privacy, audit progress, and domain analysis concurrency. One disposable
MariaDB container holds three isolated schemas: `argos_credentials_test`,
`argos_progress_test`, and `argos_domain_cache_test`. Only synthetic credentials
are used.

The `mariadb-integration` Maven profile skips the Surefire unit suite while
still compiling tests and running Failsafe integration tests. The `API backend
tests` job runs the unit suite once. The fixtures refuse non-local database
URLs and reset their schemas; never point them at production.

To run the report credential tests locally, start a disposable MariaDB schema
named `argos_credentials_test`, export ARGOS_TEST_CREDENTIALS_URL,
ARGOS_TEST_CREDENTIALS_USER and ARGOS_TEST_CREDENTIALS_PASSWORD, then execute:

```sh
mvn -P mariadb-integration -Dit.test=ReportCredentialMigrationIT,AuditPublicationIT,AuditClaimIT verify
```

CI retains Failsafe reports as an artifact. Earlier compatibility runs on
MariaDB 10.11 remain recorded in the dated release evidence; routine CI now
matches the deployed 11.4 version.
