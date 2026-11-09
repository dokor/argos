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

`AuditUrlIdentityIT` covers the V40 upgrade from V39 with existing audits and
run references, including a reproduction of the old 255-character prefix collision.
It verifies distinct 2048-character canonical URLs, exact path/query case and Unicode,
database-generated hashes on inserts/updates, duplicate rejection, collision refusal,
and concurrent creation. Run it with the same isolated credentials fixture:

```sh
mvn -P mariadb-integration -Dit.test=AuditUrlIdentityIT verify
```

V40 replaces the prefix index in one `ALTER TABLE`, backfilling a generated SHA-256
column without rewriting URLs or IDs. The unique index remains enforced throughout
the change; a failed index build leaves the previous table intact on MariaDB 11.4.
See MariaDB's [atomic DDL guarantees](https://mariadb.com/docs/server/reference/sql-statements/data-definition/atomic-ddl).
Allow for a table rebuild and its metadata lock when scheduling the migration.
DAO lookups use the hash index plus exact byte equality; a hash collision fails the
insert instead of returning another URL's audit. Rolling back to the prefix index
requires checking for newly valid URLs sharing a prefix first.
