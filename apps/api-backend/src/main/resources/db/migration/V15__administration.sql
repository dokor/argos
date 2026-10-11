ALTER TABLE ARG_USAGE_ACCOUNT ADD COLUMN monthly_limit BIGINT NULL,
 ADD CONSTRAINT ck_usage_account_limit CHECK(monthly_limit IS NULL OR monthly_limit >= 0);
CREATE TABLE ARG_ADMIN_EVENT (
 id BIGINT NOT NULL PRIMARY KEY, actor_id BIGINT NOT NULL, target_id BIGINT NOT NULL,
 old_offer VARCHAR(16) NOT NULL, new_offer VARCHAR(16) NOT NULL,
 old_limit BIGINT NULL, new_limit BIGINT NULL, created_at DATETIME(3) NOT NULL,
 KEY idx_admin_event_created(created_at)
) ENGINE=InnoDB;
CREATE INDEX idx_admin_run_status_id ON ARG_AUDIT_RUN(status,id);
CREATE INDEX idx_admin_user_state_id ON ARG_ACCOUNT_USER(state,id);
