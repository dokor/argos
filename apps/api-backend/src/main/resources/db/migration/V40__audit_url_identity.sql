-- Replace prefix uniqueness without truncating or rewriting historical URLs/IDs.
-- A generated hash covers every writer and is backfilled by the same atomic ALTER.
-- Keep the old constraint until the full-URL index can be created successfully.
ALTER TABLE ARG_AUDIT
    ADD COLUMN normalized_url_hash BINARY(32)
        GENERATED ALWAYS AS (UNHEX(SHA2(CONVERT(normalized_url USING utf8mb4), 256))) PERSISTENT,
    ADD UNIQUE KEY uq_audit_normalized_url_hash (normalized_url_hash),
    DROP INDEX uq_audit_normalized_url;
