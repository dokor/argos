CREATE TABLE IF NOT EXISTS ARG_AUDIT_REPORT (
    id BIGINT NOT NULL AUTO_INCREMENT,
    token_hash BINARY(32) NOT NULL,
    audit_id BIGINT NOT NULL,
    run_id BIGINT NOT NULL,

    domain VARCHAR(255) NOT NULL,
    target_url TEXT NOT NULL,
    site_title VARCHAR(512) NULL,
    logo_url TEXT NULL,

    report_json LONGTEXT NOT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_report_token_hash (token_hash),
    UNIQUE KEY uq_report_run_id (run_id),
    KEY idx_report_audit_id (audit_id),
    CONSTRAINT fk_report_audit FOREIGN KEY (audit_id) REFERENCES ARG_AUDIT(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_run FOREIGN KEY (run_id) REFERENCES ARG_AUDIT_RUN(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
