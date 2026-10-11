-- Usage locks deliberately have no user FK: publication must not acquire the
-- account/session lock (claim and archive take account -> run locks).
CREATE TABLE IF NOT EXISTS ARG_USAGE_ACCOUNT (
 id BIGINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ARG_USAGE_RUN (
 id BIGINT NOT NULL PRIMARY KEY,
 user_id BIGINT NOT NULL,
 period VARCHAR(7) COLLATE utf8mb4_bin NOT NULL,
 state VARCHAR(10) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 counted_at DATETIME(3) NULL,
 KEY idx_usage_user_state_period(user_id,state,period),
 CONSTRAINT fk_usage_run FOREIGN KEY(id) REFERENCES ARG_AUDIT_RUN(id),
 CONSTRAINT ck_usage_state CHECK(state IN ('RESERVED','COUNTED','RELEASED'))
) ENGINE=InnoDB;
-- Historical dates use UTC. Keep this reference timezone on initial rollout.
INSERT IGNORE INTO ARG_USAGE_ACCOUNT(id)
 SELECT DISTINCT owner_user_id FROM ARG_AUDIT_RUN WHERE owner_user_id IS NOT NULL;
INSERT IGNORE INTO ARG_USAGE_RUN(id,user_id,period,state,created_at,counted_at)
 SELECT r.id,r.owner_user_id,DATE_FORMAT(COALESCE(p.created_at,r.created_at),'%Y-%m'),
 CASE WHEN p.id IS NOT NULL THEN 'COUNTED' WHEN r.status IN ('QUEUED','RUNNING') THEN 'RESERVED' ELSE 'RELEASED' END,
 r.created_at,p.created_at
 FROM ARG_AUDIT_RUN r LEFT JOIN ARG_AUDIT_REPORT p ON p.run_id=r.id
 WHERE r.owner_user_id IS NOT NULL;
