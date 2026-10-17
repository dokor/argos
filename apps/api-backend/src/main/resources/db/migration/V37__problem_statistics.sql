-- Dedicated, credential-free facts. Historical reports are projected in bounded batches.
ALTER TABLE ARG_AUDIT_REPORT
    ADD COLUMN problem_projection_version SMALLINT NULL,
    ADD COLUMN problem_fingerprint VARCHAR(64) NULL,
    ADD COLUMN problem_coverage_version VARCHAR(64) NULL,
    ADD COLUMN problem_partial BOOLEAN NULL,
    ADD INDEX idx_report_problem_period (created_at, id),
    ADD INDEX idx_report_problem_projection (problem_projection_version, created_at, id);

CREATE TABLE ARG_REPORT_PROBLEM_CHECK (
    report_id BIGINT NOT NULL,
    check_key VARCHAR(200) NOT NULL,
    category VARCHAR(16) NOT NULL,
    severity VARCHAR(16) NULL,
    PRIMARY KEY (report_id, check_key),
    CONSTRAINT fk_problem_check_report FOREIGN KEY (report_id)
        REFERENCES ARG_AUDIT_REPORT(id) ON DELETE CASCADE
) ENGINE=InnoDB;
