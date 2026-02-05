CREATE TABLE IF NOT EXISTS ARG_AUDIT (
                                     id BIGINT NOT NULL AUTO_INCREMENT,
                                     input_url TEXT NOT NULL,
                                     normalized_url TEXT NOT NULL,
                                     hostname VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_audit_normalized_url (normalized_url(255))
    ) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ARG_AUDIT_RUN (
    id BIGINT NOT NULL AUTO_INCREMENT,
    audit_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL,              -- QUEUED|RUNNING|FAILED|COMPLETED
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    started_at DATETIME(3) NULL,
    finished_at DATETIME(3) NULL,
    last_error TEXT NULL,
    result_json LONGTEXT NULL,
    claim_token VARCHAR(64) NULL,             -- pour claim atomique multi-worker
    PRIMARY KEY (id),
    KEY idx_run_status_created (status, created_at),
    KEY idx_run_claim_token (claim_token),
    CONSTRAINT fk_run_audit FOREIGN KEY (audit_id) REFERENCES ARG_AUDIT(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
