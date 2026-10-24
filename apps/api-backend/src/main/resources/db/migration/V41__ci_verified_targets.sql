CREATE TABLE ARG_CI_TARGET (
 id BIGINT NOT NULL PRIMARY KEY,
 public_id CHAR(36) COLLATE ascii_bin NOT NULL,
 owner_user_id BIGINT NOT NULL,
 origin VARCHAR(261) COLLATE ascii_bin NOT NULL,
 method VARCHAR(16) NOT NULL DEFAULT 'HTTPS_FILE',
 challenge_hash BINARY(32) NULL,
 challenge_expires_at DATETIME(3) NOT NULL,
 state VARCHAR(16) NOT NULL DEFAULT 'PENDING',
 verified_at DATETIME(3) NULL,
 valid_until DATETIME(3) NULL,
 next_check_at DATETIME(3) NOT NULL,
 generation BIGINT NOT NULL DEFAULT 1,
 authorization_epoch BIGINT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_ci_target_public(public_id),
 UNIQUE KEY uq_ci_target_owner_origin(owner_user_id,origin),
 KEY idx_ci_target_check(state,next_check_at),
 CONSTRAINT fk_ci_target_owner FOREIGN KEY(owner_user_id) REFERENCES ARG_ACCOUNT_USER(id),
 CONSTRAINT ck_ci_target_state CHECK(state IN ('PENDING','VERIFIED','REVOKED')),
 CONSTRAINT ck_ci_target_method CHECK(method='HTTPS_FILE')
) ENGINE=InnoDB;

-- Server-issued immutable navigation scope, populated only by future CI admissions (#463).
ALTER TABLE ARG_AUDIT_RUN ADD COLUMN ci_navigation_origins TEXT NULL;
