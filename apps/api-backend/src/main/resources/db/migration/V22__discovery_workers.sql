-- Bounded distributed discovery admission/claim, independent of audit credits/queue.
CREATE TABLE ARG_DISCOVERY_GATE (id BIGINT NOT NULL PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO ARG_DISCOVERY_GATE(id) VALUES(1);
ALTER TABLE ARG_DOMAIN_DISCOVERY
    ADD started_at DATETIME(3) NULL,
    ADD lease_until DATETIME(3) NULL,
    ADD claim_token VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD KEY idx_discovery_queue(status,created_at,id),
    ADD KEY idx_discovery_lease(status,lease_until);
