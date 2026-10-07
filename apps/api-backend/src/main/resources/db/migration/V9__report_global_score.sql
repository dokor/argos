-- Existing reports keep NULL: their historical scoring method may differ, and
-- parsing every LONGTEXT during deployment would make this migration unbounded.
-- New publications write these columns in the same transaction as the report.
ALTER TABLE ARG_AUDIT_REPORT
    ADD COLUMN global_score SMALLINT UNSIGNED NULL AFTER expires_at,
    ADD COLUMN scoring_version INT NULL AFTER global_score,
    ADD KEY idx_report_global_score (global_score);
