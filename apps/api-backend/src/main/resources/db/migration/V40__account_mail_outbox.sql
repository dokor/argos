-- Only pending deliveries are retained. Payload contains encrypted recipient and message.
CREATE TABLE ARG_ACCOUNT_MAIL_OUTBOX (
    id BIGINT NOT NULL PRIMARY KEY,
    token_id BIGINT NULL,
    payload MEDIUMBLOB NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    claim_token VARCHAR(36) NULL,
    next_attempt_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    UNIQUE KEY uq_account_mail_token (token_id),
    KEY idx_account_mail_due (next_attempt_at, id),
    KEY idx_account_mail_expiry (expires_at)
);

