# Audit list and history read model (#222)

`V9__report_global_score.sql` adds nullable `global_score` and `scoring_version` to
`ARG_AUDIT_REPORT`, plus an index on `global_score`. Publication writes both fields
in the same transaction as the report and completed run. Before writing, it checks
that the public score matches the internal aggregate and that the public
calculation's version and fingerprint match the frozen internal method.

Existing reports intentionally retain `NULL` in these columns. Their methods and
availability semantics differ, so the list and history show an unknown score for
them. The migration does not parse or rewrite all historical `LONGTEXT` values and
has no data backfill lock. If historical scores become necessary, a separate
bounded batch job should validate each report's availability, version and
fingerprint before updating its row; it should advance by primary key and commit
each batch independently.

The list and history queries select only response fields. Neither query selects
`result_json`, `report_json`, module status JSON or credentials. Opening a specific
comparison loads at most the requested report and its preceding published report.
The dashboard fetches run JSON only when technical details or detailed filters
are requested.

The new score index adds storage and one index update per report publication. The
current list and history joins use run and audit keys; the score index is intended
for future score range filtering and is not required for their present ordering.
