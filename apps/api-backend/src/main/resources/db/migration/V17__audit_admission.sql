-- Infrastructure semaphore, updated atomically with JDBC in AuditRunDao.
-- Stop workers during migration; initialize from existing unfinished work.
CREATE TABLE ARG_AUDIT_ADMISSION (
    id BIGINT PRIMARY KEY,
    pending INT NOT NULL
);
INSERT INTO ARG_AUDIT_ADMISSION (id, pending)
SELECT 1, COUNT(*) FROM ARG_AUDIT_RUN WHERE status IN ('QUEUED', 'RUNNING');

-- Every terminal transition/deletion releases capacity in the same transaction.
CREATE TRIGGER ARG_AUDIT_ADMISSION_UPDATE AFTER UPDATE ON ARG_AUDIT_RUN
FOR EACH ROW UPDATE ARG_AUDIT_ADMISSION
SET pending = GREATEST(0, pending
    + IF(NEW.status IN ('QUEUED', 'RUNNING'), 1, 0)
    - IF(OLD.status IN ('QUEUED', 'RUNNING'), 1, 0))
WHERE id = 1 AND IF(NEW.status IN ('QUEUED', 'RUNNING'), 1, 0)
    <> IF(OLD.status IN ('QUEUED', 'RUNNING'), 1, 0);

CREATE TRIGGER ARG_AUDIT_ADMISSION_DELETE AFTER DELETE ON ARG_AUDIT_RUN
FOR EACH ROW UPDATE ARG_AUDIT_ADMISSION
SET pending = GREATEST(0, pending - IF(OLD.status IN ('QUEUED', 'RUNNING'), 1, 0))
WHERE id = 1;
