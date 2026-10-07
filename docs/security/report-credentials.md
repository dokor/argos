# Report credentials (#226)

The public bearer credential is generated once during `POST /api/audits` and
returned only in that creation response. The database stores its SHA-256 hash in
`ARG_AUDIT_RUN.report_token_hash` and `ARG_AUDIT_REPORT.token_hash`. Workers publish
using the stored hash, including after a restart; they never mint a replacement.
Public report/status reads hash the supplied credential. Neither status nor admin
list/history responses return it. Admin report links use the authenticated
`/dashboard/report/{runId}` view, backed by the protected Java read endpoint.

## Migration V7

Stop every worker and API instance before applying Flyway V7, then deploy the new
binary and restart. Do not run an old binary against the migrated schema. Take a
backup first: reverting requires a database restore, because hashes cannot recover
the dropped plaintext credentials. Backups taken before V7 still contain bearer
credentials and must receive the same access restrictions as other secrets.

V7 hashes existing run credentials and preserves all published report hashes.
Published runs predating V5 inherit their report hash. Legacy queued/running rows
with no recoverable credential become FAILED with
`LEGACY_REPORT_CREDENTIAL_UNAVAILABLE`; inventing a replacement would not restore
the user's original link. Pending, published and expired links are covered by the
real migration/DAO tests on the production MariaDB 11.4 version in `mariadb-integration.yml`.

The credential is not recoverable for future email delivery. Issue #97 needs its
own creation-time delivery design; admin access does not reconstruct public links.
