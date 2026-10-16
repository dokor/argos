-- NULL preserves the full scope of historical and existing queued runs.
ALTER TABLE ARG_AUDIT_RUN ADD COLUMN execution_scope LONGTEXT NULL;
