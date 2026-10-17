-- Internal references support deduplication/cohorts only; never returned by analytics APIs.
CREATE TABLE ARG_PRODUCT_ACCOUNT_EVENT (
  event_name VARCHAR(32) NOT NULL,
  subject_id BIGINT NOT NULL,
  event_key VARCHAR(10) NOT NULL,
  user_id BIGINT NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  locale CHAR(2) NOT NULL,
  method VARCHAR(16) NOT NULL,
  PRIMARY KEY (event_name, subject_id, event_key),
  KEY idx_product_account_period (occurred_at, event_name),
  KEY idx_product_account_user (user_id, event_name, occurred_at),
  CONSTRAINT fk_product_account_user FOREIGN KEY (user_id) REFERENCES ARG_ACCOUNT_USER(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Do not infer the audience of historical runs, which may since have been claimed.
ALTER TABLE ARG_PRODUCT_AUDIT_ATTR ADD COLUMN audience VARCHAR(16) NOT NULL DEFAULT 'unknown';
