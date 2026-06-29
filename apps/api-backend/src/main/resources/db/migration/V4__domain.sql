-- =============================================================
-- V4 : Introduce ARG_DOMAIN and ARG_DOMAIN_ANALYSIS
--
-- Rationale : domain-level analysis (tech stack detection) should
-- be shared across all pages of the same hostname, rather than
-- re-computed for every URL. This migration:
--   1. Creates ARG_DOMAIN  (one row per hostname)
--   2. Creates ARG_DOMAIN_ANALYSIS  (cached tech result per domain)
--   3. Migrates existing ARG_AUDIT data (hostname → domain_id FK)
--   4. Drops the now-redundant hostname column from ARG_AUDIT
-- =============================================================

-- 1. Domain table (one row per hostname)
CREATE TABLE IF NOT EXISTS ARG_DOMAIN (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    hostname   VARCHAR(255) NOT NULL,
    created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_domain_hostname (hostname)
) ENGINE=InnoDB;

-- 2. Domain-level analysis cache (tech module result, TTL-based)
CREATE TABLE IF NOT EXISTS ARG_DOMAIN_ANALYSIS (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    domain_id   BIGINT      NOT NULL,
    result_json LONGTEXT    NOT NULL,
    analyzed_at DATETIME(3) NOT NULL,
    expires_at  DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_domain_analysis_lookup (domain_id, expires_at),
    CONSTRAINT fk_domain_analysis_domain
        FOREIGN KEY (domain_id) REFERENCES ARG_DOMAIN(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3a. Populate ARG_DOMAIN from distinct hostnames already in ARG_AUDIT
INSERT INTO ARG_DOMAIN (hostname, created_at)
SELECT hostname, MIN(created_at)
FROM   ARG_AUDIT
GROUP  BY hostname;

-- 3b. Add domain_id column to ARG_AUDIT (nullable for the migration step)
ALTER TABLE ARG_AUDIT ADD COLUMN domain_id BIGINT NULL;

-- 3c. Fill domain_id by joining on hostname
UPDATE ARG_AUDIT a
INNER  JOIN ARG_DOMAIN d ON d.hostname = a.hostname
SET    a.domain_id = d.id;

-- 3d. Enforce NOT NULL now that every row is populated
ALTER TABLE ARG_AUDIT MODIFY COLUMN domain_id BIGINT NOT NULL;

-- 3e. Add FK constraint
ALTER TABLE ARG_AUDIT
    ADD CONSTRAINT fk_audit_domain
        FOREIGN KEY (domain_id) REFERENCES ARG_DOMAIN(id);

-- 4. Drop the now-redundant hostname column
ALTER TABLE ARG_AUDIT DROP COLUMN hostname;
