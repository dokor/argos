# Report content and navigation contract (v1)

The editorial catalogue lives in `components/report/findingCatalogue.ts`, keyed by
the exact original check id, with paired FR/EN entries. The stored `title` and `id`
remain technical provenance. Observation, impact, recommendation and verification
are separate fields. Unrecognised checks retain their escaped technical text and
receive explicit translated guidance to confirm the observation.

`Issue.structuredEvidence` is optional: `source`, optional `measurement` (value,
unit), and bounded text details. Only explicit measurements with a known unit are
published. Lighthouse audit ratios are never timings. Historic string evidence is
shown as historic context; no parsing of a Java map string into measurements.

The three views share the #363 read model. Overview is initial, actions preserve
backend order, technical exposes original titles, keys, sources and evidence.
`view=overview|actions|technical`, `domain=performance|security|seo|a11y|unknown`
and `severity=critical|important|info` are whitelisted. Missing/invalid values mean
overview/all/all. A stable finding hash selects technical view, clears incompatible
filters, expands the finding and focuses its summary. Unknown hashes are explained.
History and FR/EN links preserve the reading state without localStorage.

The deterministic summary uses the same unique findings, counters, backend
priorities and coverage limits. Unvalidated free-form AI text remains in the DTO;
the page uses the factual summary. No cause is inferred from titles, and no
effort, owner or commercial gain is estimated by presentation code.

Example: `lighthouse.audit.largest-contentful-paint` has the same severity, Argos
score and priority in every view. Overview describes a main-content loading signal;
actions suggest investigating the main element; technical preserves the original
metric name and shows milliseconds only if the producer actually supplied them.

## Inventory and canonical sources

| Available producer fields | Canonical published/read field | Limits |
| --- | --- | --- |
| `AuditCheckResult.key/title/message` | `Issue.id/title/impact` | Original technical identity and observation remain visible in details. |
| `value` for explicit runtime counters, bytes, response time and certificate expiry | `structuredEvidence.measurement` | Exact check-key unit allowlist; unknown values and non-finite numbers omitted. |
| Lighthouse `numericValue/numericUnit` | Check details, then `structuredEvidence.measurement` | Milliseconds, bytes or explicit unitless value only; `check.value` remains the scoring ratio. Historic audits lack these fields. |
| Other check details (headers, TLS endpoints, samples, scores, weights) | `structuredEvidence.details` | Up to 20 named text entries, 4,000 characters per entry. Nested provenance remains text; no inferred units. |
| Carrier module and `measurementProvenance.module` | `structuredEvidence.source` | Actual observation source takes precedence over carrier. |
| Explicit measurement confidence and effort (#48/#250) | Existing `Issue`/`Priority` fields | No inferred confidence, owner, cost or effort. Unknown/low confidence requests confirmation first. |
| Editorial content | `findingCatalogue.ts`, `report-content-v1` | Exact bilingual check keys; guidance may be reused but does not group causes. |
| Free-form `summary.ai` | Retained in stored DTO | No verifiable grounding metadata exists; the page uses the deterministic factual summary. |

The catalogue covers every statically emitted site check from current module
analyzers plus common Lighthouse audit ids and its four aggregate scores. A test
compares static producer keys with the catalogue. Service-only `observatory.grade`,
`observatory.tests.passed` and `zap.scan.result` are not public findings. Arbitrary
Lighthouse audit ids and ZAP plugin ids remain open sets and use the legacy text
fallback until explicitly catalogued; unknown copy is never fabricated from a title.

Third-party text is escaped by React. Both producer and renderer bound text, remove
control/bidi characters and strip URL credentials, query strings and fragments.
Stored historical strings are not silently rewritten or parsed. Full exports must
continue to consume the complete #363 model, irrespective of current URL filters.
