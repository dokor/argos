# Backend P1 regression checks

The original audit examined checkout `b8de4211`. The delivery is based on
`origin/main` at `2f2d2021`, which already contains the pinned egress proxy,
collector isolation, raw URL component preservation, explicit failed-navigation
handling, and fixes for the high-severity npm advisories. These protections must
remain enabled; there is no production bypass for test targets.

## Runtime evidence and scoring V14

A runtime response without a `navigation` field is a legacy response, not proof
of a completed navigation. Positive findings require either an explicit
`COMPLETED` status or, for legacy responses only, both DOMContentLoaded and load
timings, nonnegative and in event order. Otherwise positive findings become
informational, unavailable observations with reason `NAVIGATION_INCOMPLETE`.
Measured defects remain eligible; missing observations must not dilute them.

Scoring version 14 distinguishes this eligibility change from previous reports.
Published reports stay frozen; neither their JSON nor their scores are migrated.

## Regression coverage

- Java URL validation rejects private IPv6 DNS answers, including mixed public
  and private answers in either order, and fails closed on DNS errors.
- Java normalization and the HTTP egress proxy preserve encoded path/query
  separators, double encoding, repeated parameters and literal plus signs.
- Both browser context guards reject private secondary destinations. HTTP and
  CONNECT proxy tests assert that private DNS answers never reach the upstream
  transport; existing tests also verify pinning and rebinding rejection.
- Runtime tests cover failed, unknown, cancelled and legacy incomplete responses
  through enrichment, score calculation and measurement coverage, while keeping
  real network defects and completed legacy observations.
- Malformed gzip/deflate request bodies cannot terminate the runtime service;
  the next health request succeeds and no browser starts.
- `qs` is updated within the existing compatible dependency range. The production
  npm audit remains the check for current advisories in both headless services.

## Commands

```sh
mvn --batch-mode -f apps/api-backend/pom.xml test
npm ci --prefix apps/playwright-service
npm test --prefix apps/playwright-service
npm run check --prefix apps/playwright-service
npm ci --prefix apps/lighthouse-service
npm test --prefix apps/lighthouse-service
npm run check --prefix apps/lighthouse-service
node --test apps/audit-egress/proxy.test.mjs
npm audit --prefix apps/playwright-service --omit=dev --audit-level=high
npm audit --prefix apps/lighthouse-service --omit=dev --audit-level=high
```

Run each command from the repository root.
The proxy tests use local synthetic servers and injected transports, never real
private infrastructure. Full Chromium sandbox/firewall verification remains in
`scripts/security/docker-smoke.sh` and the AMD64/ARM64 security jobs in CI.
