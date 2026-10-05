-- Stop all audit workers before applying this irreversible credential migration.
ALTER TABLE ARG_AUDIT_RUN ADD COLUMN report_token_hash BINARY(32) NULL;

-- Keep every pre-generated link; never regenerate its credential.
UPDATE ARG_AUDIT_RUN SET report_token_hash = UNHEX(SHA2(report_token, 256))
WHERE report_token IS NOT NULL AND report_token <> '';

-- Published pre-V5 runs may not have a pre-generated credential.
UPDATE ARG_AUDIT_RUN r JOIN ARG_AUDIT_REPORT p ON p.run_id = r.id
SET r.report_token_hash = p.token_hash WHERE r.report_token_hash IS NULL;

-- Old unpublishable runs cannot be resumed by inventing an unreachable link.
UPDATE ARG_AUDIT_RUN SET status = 'FAILED', last_error = 'LEGACY_REPORT_CREDENTIAL_UNAVAILABLE',
    finished_at = CURRENT_TIMESTAMP(3)
WHERE report_token_hash IS NULL AND status IN ('QUEUED', 'RUNNING');

ALTER TABLE ARG_AUDIT_RUN DROP INDEX idx_run_report_token, DROP COLUMN report_token,
    ADD UNIQUE KEY uq_run_report_token_hash (report_token_hash);
ALTER TABLE ARG_AUDIT_REPORT DROP INDEX uq_report_public_token, DROP COLUMN public_token;
