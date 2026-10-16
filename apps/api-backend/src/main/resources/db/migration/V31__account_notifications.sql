-- Events are committed with the business transition, even with no browser open.
-- No historical backfill and no report bearer credentials or submitted URLs.
CREATE TABLE ARG_ACCOUNT_NOTIFICATION (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 owner_user_id BIGINT NOT NULL,
 event_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 type VARCHAR(32) NOT NULL,
 entity_id BIGINT NOT NULL,
 site_id BIGINT NULL,
 hostname VARCHAR(253) NOT NULL,
 item_count INT NULL,
 created_at DATETIME(3) NOT NULL,
 read_at DATETIME(3) NULL,
 UNIQUE KEY uq_notification_event(event_key),
 KEY idx_notification_owner(owner_user_id,id),
 KEY idx_notification_unread(owner_user_id,read_at),
 KEY idx_notification_retention(created_at),
 CONSTRAINT fk_notification_owner FOREIGN KEY(owner_user_id) REFERENCES ARG_ACCOUNT_USER(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TRIGGER ARG_NOTIFY_REPORT AFTER INSERT ON ARG_AUDIT_REPORT
FOR EACH ROW
 INSERT IGNORE INTO ARG_ACCOUNT_NOTIFICATION(owner_user_id,event_key,type,entity_id,hostname,created_at)
 SELECT r.owner_user_id,CONCAT('run:',r.id),
 IF(NEW.measurement_completeness='FULL','ANALYSIS_READY','ANALYSIS_PARTIAL'),r.id,d.hostname,UTC_TIMESTAMP(3)
 FROM ARG_AUDIT_RUN r JOIN ARG_AUDIT a ON a.id=r.audit_id JOIN ARG_DOMAIN d ON d.id=a.domain_id
 WHERE r.id=NEW.run_id AND r.owner_user_id IS NOT NULL AND r.status='COMPLETED'
 AND NOT EXISTS(SELECT 1 FROM ARG_DOMAIN_BATCH_PAGE p WHERE p.run_id=r.id);

CREATE TRIGGER ARG_NOTIFY_RUN_TERMINAL AFTER UPDATE ON ARG_AUDIT_RUN
FOR EACH ROW
 INSERT IGNORE INTO ARG_ACCOUNT_NOTIFICATION(owner_user_id,event_key,type,entity_id,hostname,created_at)
 SELECT NEW.owner_user_id,CONCAT('run:',NEW.id),
 CASE WHEN NEW.status='FAILED' THEN 'ANALYSIS_FAILED' WHEN p.measurement_completeness='FULL' THEN 'ANALYSIS_READY' ELSE 'ANALYSIS_PARTIAL' END,
 NEW.id,d.hostname,UTC_TIMESTAMP(3)
 FROM ARG_AUDIT a JOIN ARG_DOMAIN d ON d.id=a.domain_id LEFT JOIN ARG_AUDIT_REPORT p ON p.run_id=NEW.id
 WHERE a.id=NEW.audit_id AND NEW.owner_user_id IS NOT NULL AND NEW.status IN ('COMPLETED','FAILED') AND OLD.status<>NEW.status
 AND (NEW.status='FAILED' OR p.id IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM ARG_DOMAIN_BATCH_PAGE p WHERE p.run_id=NEW.id);

CREATE TRIGGER ARG_NOTIFY_DISCOVERY AFTER UPDATE ON ARG_DOMAIN_DISCOVERY
FOR EACH ROW
 INSERT IGNORE INTO ARG_ACCOUNT_NOTIFICATION(owner_user_id,event_key,type,entity_id,site_id,hostname,item_count,created_at)
 SELECT NEW.owner_user_id,CONCAT('discovery:',NEW.id),
 CASE WHEN NEW.status='FAILED' THEN 'DISCOVERY_FAILED' WHEN NEW.truncated THEN 'DISCOVERY_PARTIAL' ELSE 'DISCOVERY_READY' END,
 NEW.id,NEW.site_id,d.hostname,NEW.eligible_count,UTC_TIMESTAMP(3)
 FROM ARG_ACCOUNT_SITE s JOIN ARG_DOMAIN d ON d.id=s.domain_id
 WHERE s.id=NEW.site_id AND NEW.status IN ('COMPLETED','FAILED') AND OLD.status IN ('QUEUED','RUNNING');

CREATE TRIGGER ARG_NOTIFY_BATCH AFTER UPDATE ON ARG_DOMAIN_BATCH
FOR EACH ROW
 INSERT IGNORE INTO ARG_ACCOUNT_NOTIFICATION(owner_user_id,event_key,type,entity_id,site_id,hostname,item_count,created_at)
 SELECT NEW.owner_user_id,CONCAT('batch:',NEW.id),
 CASE NEW.status WHEN 'COMPLETED' THEN 'BATCH_READY' WHEN 'PARTIAL' THEN 'BATCH_PARTIAL' ELSE 'BATCH_FAILED' END,
 NEW.id,NEW.site_id,d.hostname,NEW.selected_count,UTC_TIMESTAMP(3)
 FROM ARG_ACCOUNT_SITE s JOIN ARG_DOMAIN d ON d.id=s.domain_id
 WHERE s.id=NEW.site_id AND NEW.status IN ('COMPLETED','PARTIAL','FAILED') AND OLD.status IN ('QUEUED','RUNNING');
