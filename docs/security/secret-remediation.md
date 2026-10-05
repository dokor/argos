# Exposed credentials — #219

Tracked application configuration contains no default password. Set DB_PASSWORD
and INTERNAL_API_PASSWORD in the service environment, or the corresponding
properties in the externally mounted prod.conf. The application validates both
before opening the DB or serving requests. Missing/blank values stop startup with
only the configuration key in the error. ADMIN_API_TOKEN remains a distinct secret
for admin reads, documented in audit-access.md.

Gitleaks 8.30.1 scans a clean tracked snapshot plus all newly introduced commits
on each PR/main push. Its official archive is verified against release checksums.
The default rules are extended with literal HOCON password detection; only env
substitutions and exact synthetic H2/internal test values are exempted. A negative
synthetic probe must fail with exit 1. Scanner output is fully redacted. There is
no broad exclusion for tests/configuration and no baseline suppressing findings.

## Operational steps still required

Code removal does not revoke an exposed credential. The authorized operator must:

1. Generate replacements outside Git/GitHub. Rotate the MariaDB account password
   and internal API password, update externally mounted configuration and verify
   connections/authentication with the new values.
2. Verify old credentials no longer authenticate. Keep only credential identifiers,
   rotation date, operator and a redacted revocation result as evidence.
3. Inventory old clones, images, backups and logs without posting secret values.
   Run a fully redacted history scan in a restricted environment.
4. Decide separately whether to rewrite history. Prepare backup, contributor
   coordination, branch/tag handling, fork/cache limitations and fresh clones
   before an authorized rewrite/force push. History rewriting never replaces
   rotation. No rewrite, rotation or production deployment is performed by this PR.

Legacy Git history can still contain revoked/exposed values. CI deliberately scans
the current tracked tree and incoming commits rather than claiming that historical
cleanup occurred. #219 remains open until the operator's rotation/revocation
evidence and history decision are recorded. #259 must keep this gate pending.
