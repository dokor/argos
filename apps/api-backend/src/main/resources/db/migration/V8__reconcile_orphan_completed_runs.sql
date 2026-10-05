-- Old swallowed publication errors could leave COMPLETED runs without reports.
-- Preserve existing public links; expose a terminal failure instead of infinite polling.
UPDATE ARG_AUDIT_RUN r LEFT JOIN ARG_AUDIT_REPORT p ON p.run_id = r.id
SET r.status = 'FAILED', r.last_error = 'LEGACY_REPORT_PUBLICATION_MISSING',
    r.finished_at = COALESCE(r.finished_at, CURRENT_TIMESTAMP(3))
WHERE r.status = 'COMPLETED' AND p.id IS NULL;
