-- Extend the authoritative ledger, never a second monthly counter.
-- No integration/account FK: publication locks run -> queue -> usage, never account/key.
ALTER TABLE ARG_USAGE_RUN
 ADD COLUMN ci_integration_id BIGINT NULL,
 ADD COLUMN ci_target_hash BINARY(32) NULL,
 ADD COLUMN ci_intent_id CHAR(36) COLLATE ascii_bin NULL,
 ADD COLUMN ci_sample INT NULL,
 ADD COLUMN ci_started_at DATETIME(3) NULL,
 ADD KEY idx_usage_ci_month(ci_integration_id,state,period),
 ADD KEY idx_usage_ci_active(state,ci_integration_id),
 ADD KEY idx_usage_ci_target(ci_target_hash,state),
 ADD KEY idx_usage_ci_intent(ci_intent_id,ci_sample,state),
 ADD KEY idx_usage_ci_running(user_id,state,ci_started_at),
 ADD CONSTRAINT ck_ci_usage_attribution CHECK (
   (ci_integration_id IS NULL AND ci_target_hash IS NULL AND ci_intent_id IS NULL AND ci_sample IS NULL AND ci_started_at IS NULL)
   OR (ci_integration_id IS NOT NULL AND ci_target_hash IS NOT NULL AND ci_intent_id IS NOT NULL AND ci_sample IS NOT NULL AND ci_sample IN (1,2))
 );
