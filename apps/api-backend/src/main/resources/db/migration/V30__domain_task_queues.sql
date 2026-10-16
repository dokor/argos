-- Admission is serialized by the account lock. Running discovery claims use the global gate.
-- Retain generated columns for compatibility with existing QueryDSL mappings.
ALTER TABLE ARG_DOMAIN_DISCOVERY DROP INDEX uq_discovery_active_owner,
    ADD KEY idx_discovery_active_owner(active_owner_id),
    ADD KEY idx_discovery_owner_started(owner_user_id, started_at);
ALTER TABLE ARG_DOMAIN_BATCH DROP INDEX uq_batch_active_owner,
    ADD KEY idx_batch_active_owner(active_owner_id);

CREATE INDEX idx_audit_owner_started ON ARG_AUDIT_RUN(owner_user_id, started_at);
