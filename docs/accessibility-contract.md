# Accessibility contract — #261–#263

Three dependent PRs deliver normalized Lighthouse evidence, persisted qualification and FR/EN rendering. No new network collection, score category or database migration.

## Technical evidence v1

Accessibility audit references are deduplicated and counted independently of the existing cross-category ceiling of 12 checks. At most 50 failed audit findings are stored. Counts refer to audits, not WCAG criteria or unique DOM elements. Element counts refer to reported Lighthouse detail rows and may overlap between audits. Missing/error/unsupported audit results make automated coverage PARTIAL. Manual and not-applicable results are distinct; COMPLETE only means all referenced automatic results were available, never a complete accessibility audit.

No DOM snippets, selectors, node attributes, external text or URLs are persisted in this evidence. Findings use an audit-ID allowlist and curated descriptions. Unknown audit IDs are retained only when they match a bounded slug and have no inferred WCAG mapping. Mapping v1 supports image-alt (1.1.1), color-contrast (1.4.3), button-name/label (4.1.2), html-has-lang/html-lang-valid (3.1.1), as partial technical associations to WCAG 2.2, never proof of conformance. Sources: [W3C 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html), [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html), [3.1.1](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html), consulted 2026-10-05.

## Admission and sequencing

The human request admits implementation and PR preparation. #260 has not approved the legal matrix or final wording. #262/#263 will remain draft pending that review. Runtime rules must report that pending state and retain UNKNOWN regulatory risk. Passive indicators are hypotheses; absence is never OUT_OF_SCOPE. No sanction amounts are published.
