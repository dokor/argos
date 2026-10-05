# MariaDB integration — #224

The `mariadb-integration` Maven profile executes Failsafe ITs against an isolated
MariaDB schema after real Flyway migrations. CI provides MariaDB 10.11 and 11.4 in
`.github/workflows/mariadb-credentials.yml`, with synthetic credentials only. The
fixture refuses any URL except localhost/127.0.0.1 with database name
`argos_credentials_test`, and resets it before each scenario. Never point these
destructive fixtures at another database. The default unit suite requires no DB.

To run locally with a disposable MariaDB, export ARGOS_TEST_CREDENTIALS_URL,
ARGOS_TEST_CREDENTIALS_USER and ARGOS_TEST_CREDENTIALS_PASSWORD, then execute:

```
mvn -P mariadb-integration -Dit.test=ReportCredentialMigrationIT,AuditPublicationIT,AuditClaimIT verify
```

Tests cover hash-only migration and links; transaction rollback and retry;
concurrent publication and HTTP creation; twelve competing claims; queue order and
terminal/owned row exclusion; retry attempt counts and preserved credential;
and the real unique token-hash constraint. CI retains Failsafe results, including
the count of actually executed tests. Synthetic fixtures are not production or
Raspberry measurements. The old commented H2 Guice installer is removed rather
than presented as equivalent evidence of MariaDB concurrency.
