CREATE TABLE ARG_ACCOUNT_SITE (
 id BIGINT NOT NULL PRIMARY KEY, owner_user_id BIGINT NOT NULL, domain_id BIGINT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_account_site(owner_user_id,domain_id),
 CONSTRAINT fk_site_owner FOREIGN KEY(owner_user_id) REFERENCES ARG_ACCOUNT_USER(id),
 CONSTRAINT fk_site_domain FOREIGN KEY(domain_id) REFERENCES ARG_DOMAIN(id)
) ENGINE=InnoDB;
CREATE TABLE ARG_ACCOUNT_SITE_URL (
 id BIGINT NOT NULL PRIMARY KEY, site_id BIGINT NOT NULL, audit_id BIGINT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_site_url(site_id,audit_id),
 CONSTRAINT fk_site_url_site FOREIGN KEY(site_id) REFERENCES ARG_ACCOUNT_SITE(id),
 CONSTRAINT fk_site_url_audit FOREIGN KEY(audit_id) REFERENCES ARG_AUDIT(id) ON DELETE CASCADE
) ENGINE=InnoDB;
ALTER TABLE ARG_AUDIT_RUN ADD KEY idx_owner_audit_latest(owner_user_id,audit_id,created_at,id);
ALTER TABLE ARG_AUDIT_REPORT ADD COLUMN provisional BOOLEAN NULL;
