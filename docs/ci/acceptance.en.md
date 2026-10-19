# Premium CI acceptance — #467

[Français](acceptance.md). Status: **NO_GO**. No external acceptance environment is
currently available (19 October 2026). This document does not authorize merging,
deployment, payments or CI activation. Keep #467 open until actual acceptance passes.

## Controlled evidence and its limits

Run the full **CI** workflow using `workflow_dispatch` on the candidate branch;
stacked PRs do not trigger the workflow restricted to `main`. Record the exact SHA,
run URL, conclusions and artifacts. Parent runs are references, not evidence for
subsequent changes.

`PremiumCiJourneyIT` uses isolated MariaDB 11.4, real sessions, rights, keys, admission,
quota accounting and publication. It joins an active FREE account, duplicated signed
webhook, authoritative billing reread, bounded Premium grant, domain verification,
mandatory key, two reserved measurements, confirmed private verdict, rotation,
refund and grant expiry. Browser returns and webhooks alone cannot grant rights.
New admissions stop after rights are lost; admitted work and reads survive without
another charge. Revoked credentials cannot read the verdict.

**Stripe, HTTPS/DNS proof and measurements are synthetic in this journey.** Actual
controlled collectors run separately in `ControlledAuditE2eIT`; the standalone client
and publishers run against TLS fixtures. Combining those proofs does not establish
a hosted provider end-to-end pass.

| #467 criterion | Candidate-SHA automated evidence | Still required |
| --- | --- | --- |
| New customer and opt-out | `PremiumCiJourneyIT`, `portable-client-network.test.mjs`, pinned templates | Real GitHub Actions and GitLab CI, zero Git mutations on opt-out |
| Direct Java/BFF authorization | `CiEntitlementIT`, `CiTargetsIT`, `CiKeysIT`, `CiAdmissionIT`, machine/management proxy tests | Full matrix through deployed routing |
| Races and accounting | `CiQuotaIT`, `CiAdmissionIT`, `PremiumCiJourneyIT`, `AuditPublicationIT` | Cross-runner recovery with a durable journal, no extra charge |
| Network containment | Native AMD64/ARM64 jobs, controlled collectors, `audit-security.test.mjs` | Actual target-host UID firewall, IPv4/IPv6, sandbox and cleanup |
| Confidentiality | Admission, retention, projection and boundary tests | Actual proxy/APM, provider logs/artifacts, deletion of copies |
| Optional issues | Publication sync, GitHub and GitLab network fixtures | Hosted permissions, visibility, pagination, Azure CAS/lease/restore |
| Billing | `BillingIT`, joined journey, Billing contracts/UI | Real Stripe sandbox, monthly/annual Tax/invoice/portal and lifecycle |
| Operations | Capacity/refusal, retention and stable-error tests | Measured host capacity, connected and exercised alerts |
| FR/EN docs and UX | Public-docs tests, component tests, seven visual-review groups | A new developer completes setup and error recovery without assistance |

Access matrices must include anonymous, unverified, FREE, owning Premium, other
account, other integration, read-only, expired/revoked key and archived account.
Exercise direct Java and BFF methods, unknown versions, path variants and redirects.
Do not reveal whether another owner's resource exists. A passing named suite is
partial evidence; it does not complete its entire acceptance row.

## Reproduction and evidence collection

From the repository root, without external credentials:

```sh
python3 -B scripts/ci/test_premium_acceptance.py
cd apps/api-backend
mvn --batch-mode test
```

Integration tests require a **disposable** loopback MariaDB schema named
`argos_credentials_test` and the CI job's `ARGOS_TEST_CREDENTIALS_URL/USER/PASSWORD`
variables. The fixture empties and migrates the database before each test. Never
provide useful data. Locally skipped integration tests are not passes. The workflow's
explicit integration list includes the new journey and the existing suites.

After the job runs `mvn -P mariadb-integration ... verify`, it collects eleven JUnit
suites: closed CI/Billing defaults, joined journey, billing, entitlements, targets,
keys, quotas, admission/private verdict, publication atomicity and retention.

```sh
# Clean CI checkout at the exact GITHUB_SHA.
python3 -B scripts/ci/premium_acceptance.py --output outputs/premium-ci-acceptance.json
# Local diagnostics: always INCOMPLETE / NO_GO, including stale green reports.
python3 -B scripts/ci/premium_acceptance.py --preview --output outputs/premium-ci-local.json
# Explicit gate: exits nonzero while actual/commercial acceptance is missing.
python3 -B scripts/ci/premium_acceptance.py --check-launch --output outputs/premium-ci-gate.json
```

The report only includes revision, statuses, counts, report digests and fixed blocker
IDs. It never copies test names, JVM properties, bodies, private URLs or raw errors.
Missing, malformed, oversized, DTD/entity, foreign-suite, skipped, failed, empty or
inconsistent reports fail closed. Revision binding requires a clean checkout and the
current GitHub run. Local preview cannot produce revision-bound CI evidence.
The synthetic artifact lasts 14 days; customer policies remain private artifacts
≤7 days, diagnostics ≤24 hours, server reports ≤30 days.

`controlledStatus=PASS` only covers these eleven suites. Review the remaining CI jobs,
secret scan and visual runs separately. `launchStatus` stays **NO_GO**. No imported
self-declared JSON clears hosted/commercial blockers. Record real evidence in #467,
then update the acceptance dossier in a reviewed PR before a human release decision.
The collector cannot change flags or authorize release.

## Hosted acceptance once resources exist

Use two Argos accounts, a controlled HTTPS domain, Stripe sandbox, dedicated GitHub
repository and GitLab.com project, and a **private** Azure container for the journal.
Configure protected secrets through the supplied templates; record only references.
Follow the linked runbooks before each exercise.

1. Start from a new account. Complete monthly and annual sandbox subscriptions,
   checking EUR amounts excluding tax and actual tax-inclusive totals. Checkout
   return/abandonment grants nothing. Exercise signed delayed/duplicate/out-of-order
   events, lost responses, renewal, failed payment/recovery, cancellation/end,
   refund, dispute and cross-account isolation.
2. Verify/revoke/renew the domain; issue a domain-bound key with minimal scopes.
   Doctor must not resolve/contact targets, create work or reserve credits. Check
   secret concealment in UI, unintended clipboard operations and diagnostics.
3. Run both pinned templates on protected branches/environments; exercise opt-out,
   preview and explicit publication opt-in. Public repositories receive `publicIssue`
   only. Test missing permissions, visibility changes, hostile fork/PR/MR, substituted
   hash/provenance and untrusted code with no credentials.
4. Recover the same intention after lost response, rotation, interruption and publisher
   outage. Prove one charge per published measurement and no new admission. Test
   deduplication, complete pagination, ambiguous POSTs and human notes/closures/ignore
   decisions. Exercise CAS, lease fencing and journal backup/restore across real
   runners. GITHUB_TOKEN does not replace private Azure journal permissions.
5. Search logs, annotations, artifacts, issues and APM for a synthetic marker, including
   verbose and error paths; verify deletion and retention ceilings. Never publish a
   dump containing credentials as evidence of a leak.
6. Exercise the [network threat model](network-threat-model-v1.md) on the target host:
   no internal contact, strict TLS, sandbox, no surviving Chromium after timeout or
   disconnect. Explicitly accept delegation to SSL Labs/Observatory.
7. Have a new developer follow both public documentation paths, recover common
   errors, and review mobile/desktop, themes and keyboard interactions. Keep redacted
   evidence tied to the candidate SHA.

## Operations and support

Before a pilot, connect aggregated signals to authenticated internal monitoring,
without URLs, emails, owners, keys or provider IDs as labels. JVM/Grizzly and collector
monitoring exists; connected Premium alerts and production capacity are **unverified**.

| Signal | Alert exercise and response |
| --- | --- |
| Oldest queued admission, audit durations, active/queued counts | Client budget exceeded or no progress: suspend new admission and inspect workers/collectors |
| Capacity/quota denials, 5xx, impossible controls | Increase relative to pilot: correlate private requestId, inspect saturation, recover existing intention |
| Authentication denials and limiters | Sustained spike: investigate abuse/rotation, preserve indistinguishable responses |
| Billing reconciliation age/failures and expired/divergent grants | Approaching the 15-minute freshness limit: Argos incident, inspect Stripe reads/events, no compensating manual grant |
| Journal lease, uncertain publication and purge errors | Stop issue mutations, reconcile/restore state; no new audit or extended retention |

Measure baseline and bounded increasing concurrency on the target: CPU/RAM, median
and p95 duration, waiting, throughput, denials and recovery after worker loss. Include
two measurements per admission, Chromium and existing anonymous traffic. Set alert
windows, technical capacity and on-call ownership from measurements, not laptop or
GitHub runner performance. Commercial limits remain 30 analyses/month/key, three
keys, unlimited verified domains, one concurrent audit and a one-year key lifetime;
they do not certify host capacity.

Support asks only for code, requestId, stage, client version and a redacted run
reference. Use the [error](errors.md) and [billing](billing.md) runbooks. Argos outages
require operator action; never ask users to weaken TLS, SSRF, sandbox or secret
redaction. Restrict access to diagnostics and enforce limited retention.

## Progressive launch and rollback

1. **Now: NO_GO.** Keep `premium-ci.enabled`, `billing.enabled`,
   `billing.payments-enabled`, `billing.prices-approved`, `billing.launch-approved`,
   `billing.tax-ready` false. Do not invent prices or VAT.
2. Approve EUR monthly/annual prices, annual discount, tax display and grace, credit,
   refund, dispute and closure policy. Account closure currently waits for the actual
   subscription end: accept or change this behavior before selling subscriptions.
3. With authorized test resources, complete actual acceptance, alerts, capacity and
   security review at the candidate SHA; record all P0 evidence and a human decision
   in #467, plus the repository's general release process where applicable.
4. A pilot requires separate authorization, low volume and observed results before
   expansion. This batch never changes configuration or provisions Stripe resources.
5. On incident, stop **new** CI admissions and sales (`premium-ci.enabled=false`,
   `billing.payments-enabled=false`), pause publishers and preserve intentions, ledger
   and journal. Do not repeat ambiguous POSTs. The global CI switch also stops machine
   authentication: account for read impact and resume admitted runs after diagnosis.
   Do not blindly disable `billing.enabled` after real subscriptions exist: preserve
   reconciliation, invoices, portal and cancellation; follow [Billing continuity](billing.md).

Related runbooks: [keys](keys.md), [admission](admission.md), [quotas](quotas.md),
[private exports](private-exports.md), [verdicts](verdicts.md),
[sync](issue-synchronization.md), [GitHub](github-publication.md),
[GitLab](gitlab-publication.md), [public docs](public-documentation.md).
