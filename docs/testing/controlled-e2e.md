# Controlled audit E2E (#64)

The `Controlled audit E2E` CI job runs a production Next build, actual Jersey HTTP resources, production audit orchestration, real Flyway/MariaDB 11.4, two competing queue workers, Chromium, and the runtime/Lighthouse HTTP apps. A separate browser harness submits the public form, opens progression, observes QUEUED → RUNNING → COMPLETED, verifies the domain heading and persisted weighted coverage beside the Argos score, opens measurement details from the summary with focus transfer, distinguishes module completeness from weighted coverage, and checks private reads are denied. Eight completed runs must each have one claim attempt and exactly one published report.

## Fixtures and boundaries

Controlled cases: healthy page, JS/console errors and an image without alt, redirect, Lighthouse partial, Lighthouse empty, runtime/Lighthouse unavailable, anti-bot challenge, and a response stalled beyond the HTTP budget. Modules end in terminal states and degraded cases preserve independent results with explicit coverage instead of fabricated zero. Anti-bot challenge content cannot become site defects. Chromium runs on local content only.

The submitted origin uses documentation IP `203.0.113.10:3020`, allowing the normal frontend/backend URL validators to run without external DNS. A test-only HTTP transport adapter maps exactly that origin to the local sample server, including SEO resources and redirects. Headless client adapters also map that fixture origin to loopback. No production SSRF exception, environment flag or validation bypass is added. This transport fixture does not replace the separate SSRF/security tests.

SSL Labs, Observatory and ZAP analyzers consume controlled upstream JSON in the Java harness, with no third-party calls. The runtime and Lighthouse HTTP apps and Chromium collectors run for nominal cases; only degraded upstream responses are injected in a dedicated Node test entry point. Optional AI summary is disabled by a pass-through test service. The Java resource harness injects its dependencies directly; production Guice startup, Traefik quotas, real upstream availability, deployment resources and production credentials are separate acceptance checks. This suite must not be presented as a production/Raspberry smoke test.

## Reproduction

Use only an isolated MariaDB database named `argos_credentials_test` on localhost (the fixture rejects other URLs and resets it). Set `ARGOS_TEST_CREDENTIALS_URL`, user/password and `ARGOS_E2E=true`. Install the existing three npm dependency sets, then from playwright-service run `npx playwright install --with-deps chromium`. Set `API_BASE=http://127.0.0.1:8081`, `PLAYWRIGHT_SERVICE_URL=http://127.0.0.1:3016`, `LIGHTHOUSE_SERVICE_URL=http://127.0.0.1:3017`, runtime timeout 10 seconds and Lighthouse timeout 30 seconds. Build/start console-web on 3000 and start `node scripts/e2e/headless.mjs`, then:

```
mvn -f apps/api-backend/pom.xml -P mariadb-integration -Dit.test=ControlledAuditE2eIT verify
```

The browser harness is `scripts/e2e/browser.mjs`, distinct from the runtime audit service. It uses the repository's Playwright dependency to avoid adding another browser version. CI retains sanitized scenario/status/coverage evidence and test reports, without browser traces, screenshots, raw report JSON or URLs containing report credentials. Only synthetic fixtures are used. Public-site smoke tests are deliberately absent from deterministic CI; any future optional smoke target requires explicit authorization and a separate opt-in command.

After the suite, CI makes a consistent `mariadb-dump --single-transaction --hex-blob`, restores it into a separate isolated database, and compares report counts and digests covering IDs, run IDs, token hashes and frozen JSON. Only a PASS evidence JSON is retained, never the dump. This verifies a current-schema data backup/restore on the fixture service; restoring a production pre-migration backup and testing the previous application binary remain operator release gates.
