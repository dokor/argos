# Argos Premium CI client — preview 0.1.0

Node.js 24, no npm dependencies or Docker. **Server access remains disabled until
acceptance #467.** The [GitHub](templates/github-actions.yml) and
[GitLab](templates/gitlab-ci.yml) examples pin the standalone distribution to a
full commit and an independently reviewed SHA-256. They execute no project code.
Ticket publishers are subsequent work (#738/#739/#740); this version offers
optional **publication preview only**, with no Git mutations.

Set the protected secret ARGOS_API_KEY and the authorized public HTTPS
ARGOS_TARGET_URL. The key needs audits:write, results:read and usage:read. The
API origin is fixed to https://argos.lelouet.fr; redirects and insecure TLS are
rejected. Requests are limited to 15 seconds including streamed bodies, within
ARGOS_TIMEOUT_SECONDS (default 1200, maximum 3600). Unknown CLI arguments, response
schemas and fields fail closed. Only controlled diagnostics are printed; no
private response, raw exception, secret or target value appears in output.
ARGOS_LANG=en selects English diagnostics. There is no verbose mode.

Commands: --help, --version, doctor, intent, audit, resume, export, artifact-check,
publication-preview. Doctor reads policy/identity/preflight only: no target DNS
or HTTP, run, reservation, file or Git mutation. READY does not reserve capacity.
Audit defaults to two sequential samples, reserving two analyses together. A
single sample is exploratory and cannot produce GO. Only the confirmed server
verdict decides. Exit codes: GO=0, SITE_NO_GO=1, CONTROL_FAILED=2; enabled
publication failure=3 without replacing the control job's audit result.

The same provider/repository/run keeps its derived idempotency UUID across job
retries. After a lost response, recover by key before a bounded replay of the
same POST/key/body. Permanent failures do not retry. Reads retry at most three
times with backoff, jitter and Retry-After; polling is sequential, around 5 then
10 seconds. Changed input conflicts instead of creating a new intention. For
multiple intentions per pipeline, explicitly assign distinct durable UUIDs.
Resume is read-only and uses the original intention/configuration; it does not
validate new target parameters or recreate an expired report. Preserve the
original ARGOS_IDEMPOTENCY_KEY when restarting outside the original pipeline.

SIGINT/SIGTERM cancels local I/O and waits. A killed runner may not print a final
diagnostic. Neither cancels the remote admission: server deadlines/scheduler
recovery release reservations under the server policy. Resume that same intent.
A produced report, including a partial one, costs one analysis; a failed run
without a report releases its reservation. Premium limits: 30 analyses/month
per stable key integration, three keys, one concurrent audit per account,
unlimited verified domains, one-year keys. Rotation preserves usage and access
only within the original integration/scope. Expired/revoked keys fail explicitly.

Private export is opt-in (ARGOS_EXPORT_PRIVATE=1). Evidence contains only the
filtered verdict and provenance, no URL or credential; maximum 64 KiB and seven
days. Use a private physical directory with no symlinks and restrictive ACLs
(0600 files on Unix). Existing files are never overwritten. Export checks
summary-v1/details-v1 and the expected COMPLETED run before writing details.json;
the examples never upload this detailed file. omittedFindings is not a verdict.
Server reports expire within 30 days. Deleting one does not revoke provider copies.
Delete those separately; diagnostics must not be retained beyond 24 hours.

Artifact upload requires explicit consent and API verification of a private
destination. GitLab also requires keep_latest_artifact=false and maintainer-only
artifact access. GitHub preview receives the exact producer artifact ID and
digest via job outputs. GitLab preview verifies the current pipeline producer
job/SHA and reads the digest from its controlled API trace, outside the artifact.
It requires a protected project-scoped read_api token ARGOS_GITLAB_READ_TOKEN.
The client then validates repository/SHA/run/attempt/producer/environment,
version/schema/expiry, external digest, regular non-symlink/non-hardlink file and
size. No API key is needed for publication preview, no audit is rerun, and no
provider credential is sent to Argos. A producer failure cannot authorize findings.

Use protected default branches/environments, no fork/PR/MR event, no untrusted
project scripts or artifacts executed with secrets. GitHub uses hosted Ubuntu;
GitLab.com requires a dedicated protected Linux shell runner tagged argos-ci,
Node 24.21.0 and curl, fresh workspaces and no project cache. The sample does not
deploy or roll back anything. SHA/environment are declarations, never evidence
of the deployed revision. Self-hosted provider APIs are not supported yet.

For local use, also supply ARGOS_REPOSITORY, ARGOS_SHA (40 hex), ARGOS_INVOCATION
(e.g. 123:1), ARGOS_PRODUCER_ID. ARGOS_ENVIRONMENT is production/staging/preview;
ARGOS_OUTPUT_DIR defaults to .argos-ci; ARGOS_SAMPLES defaults to 2.
ARGOS_EXPORT_RUN_ID selects a completed run for export. No NODE_OPTIONS,
TLS bypass, shell tracing, raw HTTP logging or environment dump. The templates
clear NODE_OPTIONS and enforce TLS. ARGOS_DEFAULT_BRANCH is main unless changed.

Build reproducibility and real local TLS fixtures are checked with
`node scripts/ci/build-client.mjs --check` and
`node --test scripts/ci/portable-client*.test.mjs`. These fixtures do not claim
hosted-provider acceptance, real ticket creation or production verification.
Provider acceptance, cleanup/reaper checks, documentation #742 and subsequent
publishers must pass #467 before enabling server access. The reserved /en/docs/errors
links will become available with #742; the [French contract](README.md) and
[versioned error contract](../../docs/ci/errors.md) are available now.
