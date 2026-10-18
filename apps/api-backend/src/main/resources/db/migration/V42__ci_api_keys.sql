-- Stable slots survive rotation/replacement: future usage attribution never follows the secret.
CREATE TABLE ARG_CI_INTEGRATION (
 id BIGINT NOT NULL PRIMARY KEY,
 public_id CHAR(36) COLLATE ascii_bin NOT NULL,
 owner_user_id BIGINT NOT NULL,
 slot INT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_ci_integration_public(public_id),
 UNIQUE KEY uq_ci_integration_slot(owner_user_id,slot),
 CONSTRAINT fk_ci_integration_owner FOREIGN KEY(owner_user_id) REFERENCES ARG_ACCOUNT_USER(id),
 CONSTRAINT ck_ci_slot CHECK(slot>0)
) ENGINE=InnoDB;
CREATE TABLE ARG_CI_API_KEY (
 id BIGINT NOT NULL PRIMARY KEY,
 public_id CHAR(32) COLLATE ascii_bin NOT NULL,
 integration_id BIGINT NOT NULL,
 secret_hash BINARY(32) NOT NULL,
 name VARCHAR(80) NOT NULL,
 scopes_json TEXT NOT NULL,
 targets_json TEXT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 overlap_until DATETIME(3) NULL,
 revoked_at DATETIME(3) NULL,
 last_used_at DATETIME(3) NULL,
 UNIQUE KEY uq_ci_key_public(public_id),
 UNIQUE KEY uq_ci_key_hash(secret_hash),
 KEY idx_ci_key_integration(integration_id,id),
 CONSTRAINT fk_ci_key_integration FOREIGN KEY(integration_id) REFERENCES ARG_CI_INTEGRATION(id),
 CONSTRAINT ck_ci_scopes_json CHECK(JSON_VALID(scopes_json)),
 CONSTRAINT ck_ci_targets_json CHECK(JSON_VALID(targets_json)),
 CONSTRAINT ck_ci_key_expiry CHECK(expires_at>created_at)
) ENGINE=InnoDB;
