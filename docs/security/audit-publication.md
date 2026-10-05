# Atomic audit completion (#228)

`ReportPublishService.completeAndPublish` composes and enriches the public report
before acquiring a database connection. Its transaction then locks the run with
`SELECT ... FOR UPDATE`, verifies the worker claim, inserts the public report and
updates the run to COMPLETED with its internal result. Every query receives the
same explicit JDBC connection. The Plume transaction manager rolls back both
writes on failure, including an exception after the run UPDATE. No network/AI
call executes while this row lock is held.

A duplicate call by the same claim returns the existing report ID. Concurrent
publishers serialize on the run lock and the unique report/run index remains the
last safeguard. A reclaimed worker cannot publish or fail the new attempt. A late
error cannot change an already completed run. The publication service propagates
errors; the processor records FAILED (only for its own RUNNING claim), instead of
leaving COMPLETED without a report. A retry must own a RUNNING claim; it uses the
original persisted credential hash and never creates another public token.

Domain/audit creation uses the existing unique indexes to arbitrate concurrent
inserts. Only MariaDB/MySQL duplicate-key errors (SQLSTATE 23000, error 1062) are
recovered: after rollback, a fresh connection reads the winning row. Other errors
still propagate. Concurrent requests create independent runs and credentials for
the same domain/audit.

Flyway V8 reconciles historical COMPLETED rows without a report to FAILED with
`LEGACY_REPORT_PUBLICATION_MISSING`. Existing reports and hashes are preserved.
Deploy after #218 and #226, stopping workers while migrating, following the V7
maintenance/backup procedure in `report-credentials.md`.

`AuditPublicationIT` exercises production DAOs and transactions on isolated real
MariaDB 10.11 and 11.4: failures at insert, after insert and after run UPDATE;
retry using the same public link; uncommitted invisibility; duplicate publication;
stale claims; historical reconciliation; and two simultaneous real HTTP POSTs
forced to collide at both domain and audit insertion. The workflow retains the
Failsafe reports. No production database is used by these fixtures.
