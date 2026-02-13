CREATE TABLE IF NOT EXISTS ARG_AUDIT_REPORT (
    id BIGINT NOT NULL AUTO_INCREMENT
    token_hash BINARY(32) NOT NULL, -- SHA-256
    domain VARCHAR(255) NOT NULL,
    target_url TEXT NOT NULL,
    site_title VARCHAR(512) NULL,
    logo_url TEXT NULL,
    report_json LONGTEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_report_token_hash (token_hash),
    KEY idx_report_domain_created (domain, created_at)
    ) ENGINE=InnoDB;
