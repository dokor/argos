# Audit chain security — issue #488

## Policy and trust boundaries

Audits remain available without an account. Admission accepts HTTP(S), canonical
ASCII hosts or public IP literals, default ports only (HTTP 80 / HTTPS 443), and
URLs up to 2048 characters. Credentials, controls, backslashes, ambiguous numeric
hosts, trailing hostname dots, private/special-use addresses and DNS failures are
refused. Unicode domains must be submitted in ASCII/Punycode form. Fragments do
not affect collection. Queries are used for collection but excluded from diagnostics.

The BFF bounds decoded request bytes before parsing JSON (8192 bytes). Java also
bounds direct audit API bodies before Jackson. Java admission checks every DNS
answer; collection checks the URL again after queueing and at each redirect.

Admission DNS validation is **not** a connection guarantee. The mandatory egress
proxy resolves every new destination, rejects the complete answer set if any
address is non-public, then connects to the checked **literal IP**, without a
second hostname lookup. Failed DNS/configuration/proxy connections have no direct
fallback. HTTP target collection, robots and sitemap probes use this proxy; TLS
retains end-to-end hostname/certificate verification. The proxy accepts GET/HEAD
on HTTP port 80 and CONNECT on port 443 only; upgrades, bodies and other ports
are refused. It never follows redirects itself.

Browser contexts intercept requests before navigation, including frames, workers
and new pages. GET/HEAD only; WebSockets refused; service workers blocked in the
both collector contexts; downloads cancelled. Chromium has an explicit proxy, no implicit
loopback bypass, no QUIC, no direct hostname resolution and no unproxied WebRTC UDP.
The proxy, rather than interception/DNS prechecks alone, checks actual connections.

The worker shares a dedicated gateway network namespace. OUTPUT is deny by
default, with UID separation: proxy UID 1000 can resolve Docker DNS and contact
public web ports; collector UID 1001 can contact only local proxy, DevTools and
health endpoints. IPv4 and IPv6 destination rules provide another private-range
barrier. Firewall installation failure prevents proxy readiness. The serving
process drops root and all capabilities after installing rules. Workers have no
capabilities, no writable root filesystem, no secrets/host mounts, an ephemeral
home/profile, the Chromium sandbox and a versioned Playwright seccomp profile.
The profile additionally permits `chroot`: Chromium uses it inside its new user
namespace. Outside that namespace the non-root collector has no SYS_CHROOT
capability; container capabilities remain fully dropped. The default seccomp
action remains ERRNO, and neither SYS_ADMIN nor an unconfined profile is granted.
Each audit launches a fresh browser and closes it on completion/failure/deadline
or client disconnect. Linux/ARM64 sandbox compatibility must be verified on the
deployment host; there is no production `--no-sandbox` fallback.

## Limits and passive scope

- Existing backend rate admission remains authoritative, including direct API
  calls. Only the transport peer is trusted; a proxy header cannot grant a quota.
- V17 adds a global transactional semaphore for at most 100 unfinished runs,
  shared by anonymous and account submissions. Terminal transitions/deletions
  release slots in the same DB transaction; insertion failure rolls back admission.
- Runtime: two active collectors, immediate 429 when busy. Lighthouse: one Chrome
  per namespace, at most four queued requests. Both bound bodies to 8 KiB and
  inbound header/body time to ten seconds. Existing audit/module deadlines remain.
- Browser context: 300 requests, 20 MiB observed decoded data. Proxy: 32 active
  upstreams, 64 accepted clients, 1000 upstream admissions per minute, 20 MiB per
  tunnel direction/HTTP response and a 45-second connection deadline.
- Docker workers: 1 GiB RAM, 2 CPUs, 256 PIDs, bounded temporary/profile/shared
  memory. Proxy: 128 MiB RAM, 64 PIDs. No unbounded browser launch queue.
- HTTP/HTML/technology analysis operates on bounded snapshots. XML external
  entities remain disabled. ZAP remains an offline passive HAR import, with
  `sendRequests=false`, an isolated internal network and no target egress.
- Observatory and SSL Labs are disabled by default and in production compose:
  providers resolve/connect independently, so Argos cannot promise pinned
  destinations there. Re-enabling them requires a separate provider controls review.
- AI summaries are disabled in production compose. Prompt instructions and output
  bounds are defense in depth, not a tool/credential isolation guarantee. The
  existing credential-bearing Codex sidecar needs separate hardening before reuse.

## Confidentiality and untrusted output

Existing private/admin/account read controls, report hash-only credential storage,
expiry and no-store headers remain in place. Reports remain bearer links: a holder
of the complete link can read that report; this is an intentional public-audit
sharing model, not account authentication. Stored reports omit raw bodies/headers,
cookies, console samples and common credential-bearing fields. Diagnostic URLs
are reduced to origins and known credential/nonce patterns are masked. Browser
console/page errors expose counts with redacted samples. Logs omit submitted paths,
queries, credentials and untrusted exception messages. React's text rendering
continues to escape site content; no raw HTML or command execution is introduced.

Arbitrary site text can contain an unknown secret that no recognizer can identify.
Input URLs remain in the private audit database for replay, including their query;
restrict DB/backups and retain only as needed. Existing historical reports/logs
are not rewritten by this change. Review historical retention/access separately.

## Validation and rollout

Local validation is performed on synthetic fixtures only, with no offensive tests
against third parties. The Node proxy tests assert zero transport calls for denied
destinations and check mixed/changing DNS answers, pinned connection addresses,
redirect refusal, concurrency, deadline and policy-copy parity. Browser interceptor
tests exercise secondary destinations and unsafe methods. Java tests cover DNS
failure/mixed answers, malformed/reserved URLs, missing egress configuration,
direct oversized API requests and sanitized stored diagnostics. Frontend tests
cover syntax/IP policy and streaming byte limits; full lint/build/test results
are recorded in the PR.

`Audit security / Audit egress and browser isolation` runs real Chromium with the
production seccomp/firewall on isolated Docker fixtures. The synthetic public IP
is routed to a local bridge fixture, never a third party. It checks blocked direct
egress, public page collection, private redirects, frames, worker/fetch/WebSocket
requests and absence of the synthetic credential in outputs/logs. MariaDB CI runs
`AuditAdmissionIT` for concurrent queue saturation, slot release and rollback.
The existing controlled audit E2E uses an injected fixture-only transport mapping;
production validators have no bypass switch.

Before merging/deploying, require successful Docker security, MariaDB admission,
full CI and controlled E2E on the exact PR head. This workstation has no Docker;
local unit results do not certify those checks. Keep #488 open until required
evidence and host verification are recorded. Include the new security check in
branch protection and release evidence.

Stop old workers for V17 and grant the migration user TRIGGER permission. Each
service deployment syncs its own revision of the gateway source. Deploy its
gateway and worker together, with the copied seccomp profile configured through
`ARGOS_CHROMIUM_SECCOMP_PROFILE`. Verify UID rules and sandbox on the Raspberry,
health through the backend, an allowed fixture, forbidden fixture counters,
timeouts/disconnect cleanup, semaphore consistency and measured degraded-module
labels. The old debug override that disables seccomp is not a production option.

Residual limits: this is not a VM boundary against kernel/Chromium exploits. The
collector and DevTools remain local to their namespace; they are not exposed to
audited pages by the network policy, but a process compromise requires further
isolation. CONNECT is an encrypted tunnel: the gateway bounds its destination,
bytes and duration; browser interception enforces HTTP methods. It cannot prove
that a GET on an arbitrary public website is side-effect free. Sandbox/egress
controls therefore reduce, rather than eliminate, abuse of public web endpoints.

Primary implementation references:
[Chromium proxy semantics](https://chromium.googlesource.com/chromium/src/net/+/HEAD/docs/proxy.md),
[Playwright network interception](https://playwright.dev/docs/network),
[Playwright 1.63.0 seccomp profile](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json).
