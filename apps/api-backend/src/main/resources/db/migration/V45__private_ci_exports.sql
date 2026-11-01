-- Dedicated allowlisted projection. Never backfill from retained untrusted diagnostics.
ALTER TABLE ARG_AUDIT_REPORT ADD COLUMN ci_export_json TEXT NULL;
