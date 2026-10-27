# Processing budget — #223

`audit.timeout` defaults to 120 seconds, measured monotonically from processing
start (queue waiting is separate). Collection gets this budget minus a reserve of
5 seconds (10% for budgets below 50 seconds) for scoring/publication. Local stages
run in their original order on one bounded, interruptible worker. By default,
SSL/Observatory use that same sequential worker with their own per-call budget.
An explicit capacity of 2 or 3 enables one or two remote workers, respectively;
see [capacity and Raspberry measurements](progress.md). Expiry cancels the active Future with
interruption, does not start subsequent collection, and records TIMEOUT fallback
checks without scoring infrastructure failure. Already obtained results are kept.

Production Compose overrides the legacy defaults with a 360-second whole-run
budget and 180-second remote-call and SSL Labs budgets. Fresh sequential SSL
assessments can exhaust the 120-second shared budget after browser work and leave
later stages uncollected. [Deployment run 40502937161](https://github.com/dokor/argos/actions/runs/40502937161)
reported Tech and SSL deadline failures across its two samples. The five-second
publication reserve remains in place. The JVM properties take precedence over
the mounted `prod.conf`, including `external.ssl-labs.timeout`; operators can set
`ARGOS_AUDIT_TIMEOUT`, `ARGOS_REMOTE_MODULE_TIMEOUT` and `ARGOS_SSL_LABS_TIMEOUT`
in the Compose environment to choose different positive durations. Keep those
three limits consistent. This changes time bounds only; concurrency stays at its
configured value and no historical measurement is reused.

The post-deployment control allows eight minutes per sample, including queue
waiting, and twenty minutes for readiness and two sequential samples. Operator
budgets above six minutes need a corresponding review of these control limits.
Incomplete measurements still produce `CONTROL_FAILED`; longer bounds do not
guarantee that an external assessment will finish.

The same deadline is scoped onto every worker and caps each Java HTTP request;
redirects share a 30-second cumulative cap, and polls cannot reset the global
budget. SSL Labs requests a fresh assessment and waits up to `ssl-labs.timeout` (90s
by default), capped by the shared collection deadline. Polling follows the upstream
recommendation: 5s during DNS, 10s during IN_PROGRESS. Only the first request uses
`startNew=on`; polls omit it, and no request uses `fromCache`. Pending results
become unavailable with the last observed upstream status, distinct from HTTP 429.
AI enrichment is optional, skipped with less than two seconds left, and its HTTP
timeout consumes only the publication reserve. The final database commit is still
atomic (#228); database failure gives FAILED rather than a published orphan.

Runtime/Lighthouse receive remaining timeoutMs, capped at 45/60 seconds. Timeout
or client disconnect closes the actual browser/Chrome process; Lighthouse removes
cancelled queued requests. The local pool and queue are bounded, so a foreign
non-cooperative implementation cannot cause unbounded replacement threads. JVM
interrupts cannot forcibly terminate arbitrary third-party Java code: all shipped
network clients are timeout-bounded, and blocking HTTP/poll waits are interruptible.
Database connection/statement limits and JVM/OS scheduling remain operational
bounds; this is a processing deadline, not a hard real-time guarantee on a host.

Tests cover monotone cumulative budgets, actual interruption and reuse of the same
worker, partial publication with no RUNNING modules, browser cleanup, Chrome kill,
queued cancellation and successful following requests. These controlled tests do
not establish Raspberry memory/latency; #259 requires measurements on the deployed
candidate. Configure a different positive audit.timeout through mounted HOCON if
needed; there is no implicit unlimited budget.
