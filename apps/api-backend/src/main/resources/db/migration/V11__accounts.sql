CREATE TABLE ARG_ACCOUNT_USER (
 id BIGINT NOT NULL PRIMARY KEY, email VARCHAR(254) COLLATE utf8mb4_bin NULL,
 display_name VARCHAR(100) NOT NULL, state VARCHAR(16) NOT NULL,
 role VARCHAR(16) NOT NULL DEFAULT 'USER', offer VARCHAR(16) NOT NULL DEFAULT 'FREE',
 created_at DATETIME(3) NOT NULL, archived_at DATETIME(3) NULL,
 UNIQUE KEY uq_account_email(email),
 CONSTRAINT ck_account_state CHECK(state IN ('PENDING','ACTIVE','ARCHIVED'))
) ENGINE=InnoDB;
CREATE TABLE ARG_ACCOUNT_IDENTITY (
 id BIGINT NOT NULL PRIMARY KEY, user_id BIGINT NOT NULL, provider VARCHAR(16) NOT NULL,
 subject VARCHAR(255) COLLATE utf8mb4_bin NOT NULL, password_hash VARCHAR(255) NULL,
 disabled_at DATETIME(3) NULL, created_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_account_subject(provider,subject), KEY idx_identity_user(user_id),
 CONSTRAINT fk_identity_user FOREIGN KEY(user_id) REFERENCES ARG_ACCOUNT_USER(id)
) ENGINE=InnoDB;
CREATE TABLE ARG_ACCOUNT_SESSION (
 id BIGINT NOT NULL PRIMARY KEY, user_id BIGINT NOT NULL,
 csrf_hash BINARY(32) NOT NULL, created_at DATETIME(3) NOT NULL,
 authenticated_at DATETIME(3) NOT NULL, last_activity_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL, revoked_at DATETIME(3) NULL,
 KEY idx_session_user(user_id,revoked_at),
 CONSTRAINT fk_session_user FOREIGN KEY(user_id) REFERENCES ARG_ACCOUNT_USER(id)
) ENGINE=InnoDB;
CREATE TABLE ARG_ACCOUNT_TOKEN (
 id BIGINT NOT NULL PRIMARY KEY, user_id BIGINT NOT NULL, session_id BIGINT NULL,
 token_hash BINARY(32) NOT NULL, purpose VARCHAR(16) NOT NULL, email VARCHAR(254) NULL,
 expires_at DATETIME(3) NOT NULL, consumed_at DATETIME(3) NULL,
 UNIQUE KEY uq_account_token(token_hash), KEY idx_token_user(user_id,purpose),
 CONSTRAINT fk_token_user FOREIGN KEY(user_id) REFERENCES ARG_ACCOUNT_USER(id)
) ENGINE=InnoDB;
CREATE TABLE ARG_ACCOUNT_OAUTH (
 id BIGINT NOT NULL PRIMARY KEY, state_hash BINARY(32) NOT NULL, browser_hash BINARY(32) NOT NULL,
 provider VARCHAR(16) NOT NULL, intent VARCHAR(8) NOT NULL, user_id BIGINT NULL, session_id BIGINT NULL,
 nonce VARCHAR(64) NOT NULL, verifier VARCHAR(128) NOT NULL, return_path VARCHAR(600) NOT NULL,
 expires_at DATETIME(3) NOT NULL, consumed_at DATETIME(3) NULL,
 UNIQUE KEY uq_oauth_state(state_hash), KEY idx_oauth_expiry(expires_at),
 CONSTRAINT fk_oauth_user FOREIGN KEY(user_id) REFERENCES ARG_ACCOUNT_USER(id)
) ENGINE=InnoDB;
ALTER TABLE ARG_AUDIT_RUN ADD COLUMN owner_user_id BIGINT NULL,
 ADD KEY idx_run_owner_created(owner_user_id,created_at,id),
 ADD CONSTRAINT fk_run_owner FOREIGN KEY(owner_user_id) REFERENCES ARG_ACCOUNT_USER(id);
CREATE TABLE ARG_ACCOUNT_RUN_CLAIM (
 id BIGINT NOT NULL PRIMARY KEY, run_id BIGINT NOT NULL, proof_hash BINARY(32) NOT NULL,
 expires_at DATETIME(3) NOT NULL, consumed_by BIGINT NULL,
 UNIQUE KEY uq_claim_run(run_id), UNIQUE KEY uq_claim_proof(proof_hash),
 CONSTRAINT fk_claim_run FOREIGN KEY(run_id) REFERENCES ARG_AUDIT_RUN(id) ON DELETE CASCADE,
 CONSTRAINT fk_claim_user FOREIGN KEY(consumed_by) REFERENCES ARG_ACCOUNT_USER(id)
) ENGINE=InnoDB;
CREATE TABLE ARG_ACCOUNT_SECURITY_EVENT (
 id BIGINT NOT NULL PRIMARY KEY, user_id BIGINT NULL, session_id BIGINT NULL,
 action VARCHAR(32) NOT NULL, outcome VARCHAR(16) NOT NULL, created_at DATETIME(3) NOT NULL,
 KEY idx_security_created(created_at)
) ENGINE=InnoDB;
CREATE TABLE ARG_ACCOUNT_RATE (
 bucket_hash BINARY(32) NOT NULL PRIMARY KEY, attempts INT NOT NULL,
 expires_at DATETIME(3) NOT NULL, KEY idx_rate_expiry(expires_at)
) ENGINE=InnoDB;
