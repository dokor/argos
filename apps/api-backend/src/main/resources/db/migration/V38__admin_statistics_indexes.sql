-- First/latest attempt probes per persisted URL; no index on payloads or private URL text.
CREATE INDEX idx_run_audit_chronology ON ARG_AUDIT_RUN(audit_id,created_at,id);
CREATE INDEX idx_account_created ON ARG_ACCOUNT_USER(created_at);
