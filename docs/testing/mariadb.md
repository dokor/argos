# MariaDB integration

Production uses MariaDB 11.4. The `MariaDB integration (11.4)` CI job runs the
Failsafe suites for report credentials, publication and claims, newsletter
privacy, accounts/authentication, audit progress, and domain analysis concurrency. One disposable
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
