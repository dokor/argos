CREATE TABLE ARG_PREMIUM_WAITLIST (
    id BIGINT NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    locale VARCHAR(2) NOT NULL,
    consent_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    UNIQUE KEY uq_premium_waitlist_email (email),
    KEY idx_premium_waitlist_expiry (expires_at)
);
