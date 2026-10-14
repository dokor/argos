-- Durable batch execution metadata survives report retention; no duplicate report JSON.
ALTER TABLE ARG_DOMAIN_BATCH
    ADD progress_fingerprint BINARY(32) NULL,
    ADD KEY idx_batch_reconcile(status,id);
ALTER TABLE ARG_DOMAIN_BATCH_PAGE
    ADD completeness VARCHAR(16) NOT NULL DEFAULT 'NONE',
    ADD CONSTRAINT ck_batch_page_completeness CHECK(completeness IN ('FULL','PARTIAL','NONE','UNKNOWN'));
