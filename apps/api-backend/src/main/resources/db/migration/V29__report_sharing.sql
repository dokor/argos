-- One revocable share capability per published report. Never persist the clear token.
ALTER TABLE ARG_AUDIT_REPORT
    ADD COLUMN share_token_hash BINARY(32) NULL,
    ADD COLUMN share_expires_at TIMESTAMP(3) NULL,
    ADD UNIQUE KEY uq_report_share_hash (share_token_hash);
