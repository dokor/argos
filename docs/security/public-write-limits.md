# Public writes — V1 admission control (#227)

POST audits and newsletter remain public. GET report/progress routes are unaffected.

| Layer | Audits | Newsletter | Identity |
|---|---|---|---|
| Traefik | average 5 / 15 min, burst 2 | average 20 / 15 min, burst 5 | TCP peer, depth 0 |
| Java, direct peer | 5 / fixed 15 min, burst 2 / 10 s | 20 / fixed 15 min, burst 5 / 10 s | Grizzly transport remote address |
| Java, all traffic | 20 / fixed 15 min, burst 4 / 10 s | 80 / fixed 15 min, burst 10 / 10 s | one instance |

The edge uses [Traefik's token bucket](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/ratelimit/); Java uses monotonic fixed windows. These are conservative V1 defaults, with separate route budgets and atomic checks. Rejected Java requests return 429, a positive `Retry-After` in seconds and `Cache-Control: no-store`; the BFF preserves these headers. Traefik also rejects excess requests before the BFF.

## Proxy trust

Neither Java nor the BFF reads `X-Forwarded-For` or `X-Real-IP` as an identity. Java defaults to counting the connecting peer, including a proxy, and therefore fails closed if deployment configuration is absent. Operators may set `public-write.trusted-proxies = ["literal BFF IP"]` in mounted backend configuration: only those exact transport peers bypass the individual Java bucket, while the global Java bucket always applies. Their users are individually limited at Traefik. No subnet, DNS or wildcard trust; no `forwardedHeaders.insecure`. Preserve network isolation and restrict backend exposure to the intended proxy. If a CDN is added, validate its transport trust and edge quotas before rollout.

State is bounded to 4096 peer/route buckets; exhaustion returns 429 instead of allocating unbounded memory. Limits are per instance and reset on process restart. Before horizontal scaling or stronger persistent quotas, introduce a shared quota store. These limits do not replace body-size/connection limits at the reverse proxy.

## Newsletter privacy

Valid new and repeated emails use the same `INSERT ... ON DUPLICATE KEY UPDATE id=id` statement and return the identical 200 body. There is no preflight existence query, special duplicate response or raw-email log. This removes the obvious response and early-return timing oracle; it does not claim constant database timing. Concurrent requests cannot duplicate an email. The legacy 409 is normalized by the BFF during rolling deployment. An IP hint comes only from the direct transport peer; trusted proxy requests store no misleading end-user IP.

## Evidence

`PublicWriteLimiterTest` covers windows, burst, concurrent admissions and literal proxy trust. `PublicWriteHttpTest` runs actual Grizzly/Jersey requests and rotates forged forwarded headers: the sixth newsletter request is rejected before service execution and responses for new/duplicate are identical. `NewsletterPrivacyIT` races eight subscriptions against real MariaDB 11.4 in CI, asserting one row and identical results. BFF tests assert header propagation and prevent forwarding untrusted identity headers.

No production quotas or trust list have been applied by this PR; deployment verification remains a #259 gate.
