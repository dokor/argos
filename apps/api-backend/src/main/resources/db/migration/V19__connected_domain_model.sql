-- Clarte F01: new private discoveries/batches; no reset, backfill or duplicate identity/usage registry.
-- The personal domain ID is the existing ARG_ACCOUNT_SITE.id, NOT the shared ARG_DOMAIN.id.
ALTER TABLE ARG_ACCOUNT_SITE ADD UNIQUE KEY uq_site_owned_id(id, owner_user_id);
ALTER TABLE ARG_AUDIT_RUN ADD UNIQUE KEY uq_run_owned_audit(id, owner_user_id, audit_id);

CREATE TABLE ARG_DOMAIN_DISCOVERY (
    id BIGINT NOT NULL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    site_id BIGINT NOT NULL,
    idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_fingerprint BINARY(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    parameters_json LONGTEXT NOT NULL CHECK (JSON_VALID(parameters_json)),
    effective_limits_json LONGTEXT NOT NULL CHECK (JSON_VALID(effective_limits_json)),
    created_at DATETIME(3) NOT NULL,
    finished_at DATETIME(3) NULL,
    expires_at DATETIME(3) NOT NULL,
    eligible_count INT NOT NULL DEFAULT 0,
    excluded_count INT NOT NULL DEFAULT 0,
    truncated BOOLEAN NOT NULL DEFAULT FALSE,
    cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
    stop_reason VARCHAR(64) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    active_owner_id BIGINT GENERATED ALWAYS AS
        (CASE WHEN status IN ('QUEUED','RUNNING') THEN owner_user_id ELSE NULL END) PERSISTENT,
    UNIQUE KEY uq_discovery_context(id, owner_user_id, site_id),
    UNIQUE KEY uq_discovery_owner_key(owner_user_id, idempotency_key),
    UNIQUE KEY uq_discovery_active_owner(active_owner_id),
    KEY idx_discovery_owner_created(owner_user_id, created_at, id),
    KEY idx_discovery_expiry(expires_at),
    CONSTRAINT fk_discovery_site_owner FOREIGN KEY(site_id, owner_user_id)
        REFERENCES ARG_ACCOUNT_SITE(id, owner_user_id),
    CONSTRAINT ck_discovery_status CHECK(status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELED')),
    CONSTRAINT ck_discovery_counts CHECK(eligible_count >= 0 AND excluded_count >= 0 AND version >= 0),
    CONSTRAINT ck_discovery_dates CHECK(expires_at > created_at AND
        ((status IN ('QUEUED','RUNNING') AND finished_at IS NULL) OR
         (status IN ('COMPLETED','FAILED','CANCELED') AND finished_at >= created_at))),
    CONSTRAINT ck_discovery_terminal_time CHECK(status IN ('QUEUED','RUNNING') OR finished_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE ARG_DOMAIN_DISCOVERY_PAGE (
    id BIGINT NOT NULL PRIMARY KEY,
    discovery_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    site_id BIGINT NOT NULL,
    normalized_url VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    normalized_url_hash BINARY(32) GENERATED ALWAYS AS (UNHEX(SHA2(normalized_url,256))) PERSISTENT,
    source VARCHAR(16) NOT NULL,
    depth INT NOT NULL,
    eligible BOOLEAN NOT NULL,
    exclusion_reason VARCHAR(64) NULL,
    UNIQUE KEY uq_discovered_url(discovery_id, normalized_url_hash),
    UNIQUE KEY uq_discovered_page_context(id, discovery_id, owner_user_id),
    KEY idx_discovered_owner_page(owner_user_id, discovery_id, eligible, id),
    CONSTRAINT fk_discovered_context FOREIGN KEY(discovery_id, owner_user_id, site_id)
        REFERENCES ARG_DOMAIN_DISCOVERY(id, owner_user_id, site_id),
    CONSTRAINT ck_discovered_source CHECK(source IN ('INITIAL','LINK','SITEMAP')),
    CONSTRAINT ck_discovered_depth CHECK(depth >= 0),
    CONSTRAINT ck_discovered_url CHECK(CHAR_LENGTH(normalized_url) > 0),
    CONSTRAINT ck_discovered_eligibility CHECK(
        (eligible = TRUE AND exclusion_reason IS NULL) OR
        (eligible = FALSE AND exclusion_reason IS NOT NULL AND CHAR_LENGTH(exclusion_reason) > 0))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE TABLE ARG_DOMAIN_BATCH (
    id BIGINT NOT NULL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    site_id BIGINT NOT NULL,
    discovery_id BIGINT NOT NULL,
    idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_fingerprint BINARY(32) NOT NULL,
    profile_id VARCHAR(64) NOT NULL,
    profile_snapshot_json LONGTEXT NOT NULL CHECK(JSON_VALID(profile_snapshot_json)),
    selected_count INT NOT NULL,
    status VARCHAR(16) NOT NULL,
    cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL,
    finished_at DATETIME(3) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    active_owner_id BIGINT GENERATED ALWAYS AS
        (CASE WHEN status IN ('QUEUED','RUNNING') THEN owner_user_id ELSE NULL END) PERSISTENT,
    UNIQUE KEY uq_batch_context(id, owner_user_id, discovery_id, site_id),
    UNIQUE KEY uq_batch_owner_key(owner_user_id, idempotency_key),
    UNIQUE KEY uq_batch_active_owner(active_owner_id),
    KEY idx_batch_owner_site_created(owner_user_id, site_id, created_at, id),
    CONSTRAINT fk_batch_discovery_owner FOREIGN KEY(discovery_id, owner_user_id, site_id)
        REFERENCES ARG_DOMAIN_DISCOVERY(id, owner_user_id, site_id),
    CONSTRAINT ck_batch_status CHECK(status IN ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELED')),
    CONSTRAINT ck_batch_counts CHECK(selected_count > 0 AND version >= 0),
    CONSTRAINT ck_batch_dates CHECK(
        (status IN ('QUEUED','RUNNING') AND finished_at IS NULL) OR
        (status NOT IN ('QUEUED','RUNNING') AND finished_at >= created_at)),
    CONSTRAINT ck_batch_terminal_time CHECK(status IN ('QUEUED','RUNNING') OR finished_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE ARG_DOMAIN_BATCH_PAGE (
    id BIGINT NOT NULL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    site_id BIGINT NOT NULL,
    discovery_id BIGINT NOT NULL,
    discovery_page_id BIGINT NOT NULL,
    audit_id BIGINT NOT NULL,
    run_id BIGINT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    UNIQUE KEY uq_batch_selected_page(batch_id, discovery_page_id),
    UNIQUE KEY uq_batch_audit(batch_id, audit_id),
    UNIQUE KEY uq_batch_run(run_id),
    KEY idx_batch_page_owner(owner_user_id, batch_id, id),
    CONSTRAINT fk_batch_page_context FOREIGN KEY(batch_id, owner_user_id, discovery_id, site_id)
        REFERENCES ARG_DOMAIN_BATCH(id, owner_user_id, discovery_id, site_id),
    CONSTRAINT fk_batch_selected_discovery FOREIGN KEY(discovery_page_id, discovery_id, owner_user_id)
        REFERENCES ARG_DOMAIN_DISCOVERY_PAGE(id, discovery_id, owner_user_id),
    CONSTRAINT fk_batch_page_followed FOREIGN KEY(site_id, audit_id)
        REFERENCES ARG_ACCOUNT_SITE_URL(site_id, audit_id),
    CONSTRAINT fk_batch_page_run_owner FOREIGN KEY(run_id, owner_user_id, audit_id)
        REFERENCES ARG_AUDIT_RUN(id, owner_user_id, audit_id)
) ENGINE=InnoDB;
