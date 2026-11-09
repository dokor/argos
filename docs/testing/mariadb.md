# MariaDB integration

Production uses MariaDB 11.4. The `MariaDB integration (11.4)` CI job runs the
Failsafe suites matching `**/*IT.java`, including usage and global-score
migration tests. `ControlledAuditE2eIT` is excluded by the Maven profile and
runs only in the [controlled browser job](controlled-e2e.md), which explicitly
selects it with `-Dit.test=ControlledAuditE2eIT`. One disposable
MariaDB container holds three isolated schemas: `argos_credentials_test`,
`argos_progress_test`, and `argos_domain_cache_test`. Only synthetic credentials
are used.

The `mariadb-integration` Maven profile skips the Surefire unit suite while
still compiling tests and running Failsafe integration tests. The `API backend
tests` job runs the unit suite once. The fixtures refuse non-local database
URLs and reset their schemas; never point them at production.

With all three fixture schemas and their environment variables configured,
run the full database suite from `apps/api-backend`:

```sh
mvn -P mariadb-integration clean verify
python3 ../../scripts/ci/check-integration-reports.py mariadb
```

CI uses the profile without a class allowlist, so newly added `*IT.java`
classes are included automatically. After Maven, the execution guard compares
the source inventory with Failsafe XML reports: every expected class must have
tests, with no skips, failures or errors, and no extra suite may run. The
controlled E2E job applies the same guard to its single suite. Use a clean
target directory when switching jobs locally to avoid stale reports.

To run the report credential tests locally, start a disposable MariaDB schema
named `argos_credentials_test`, export ARGOS_TEST_CREDENTIALS_URL,
ARGOS_TEST_CREDENTIALS_USER and ARGOS_TEST_CREDENTIALS_PASSWORD, then execute:

```sh
mvn -P mariadb-integration -Dit.test=AccountLifecycleIT,AccountSessionSecurityIT,AccountSecurityMigrationIT,ReportCredentialMigrationIT,AuditPublicationIT,AuditClaimIT verify
```

CI retains Failsafe reports as an artifact. Earlier compatibility runs on
MariaDB 10.11 remain recorded in the dated release evidence; routine CI now
matches the deployed 11.4 version.
