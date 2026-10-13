ALTER TABLE ARG_AUDIT_RUN
  ADD COLUMN idempotency_key VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN request_fingerprint VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN profile_snapshot LONGTEXT NULL CHECK (profile_snapshot IS NULL OR JSON_VALID(profile_snapshot)),
  ADD UNIQUE KEY uq_run_owner_request (owner_user_id, idempotency_key);
