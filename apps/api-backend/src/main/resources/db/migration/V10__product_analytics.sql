-- No audited URL, token, IP, identity or private report content in these tables.
CREATE TABLE ARG_PRODUCT_EVENT_COUNT (
  event_day DATE NOT NULL,
  event_name VARCHAR(40) NOT NULL,
  source_route VARCHAR(80) NOT NULL,
  locale CHAR(2) NOT NULL,
  placement VARCHAR(16) NOT NULL,
  error_category VARCHAR(16) NOT NULL,
  event_count BIGINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (event_day,event_name,source_route,locale,placement,error_category)
) ENGINE=InnoDB;
CREATE TABLE ARG_PRODUCT_AUDIT_ATTR (
  run_id BIGINT NOT NULL PRIMARY KEY,
  source_route VARCHAR(80) NOT NULL,
  locale CHAR(2) NOT NULL,
  placement VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  first_viewed_at DATETIME(3) NULL,
  KEY idx_product_attr_created (created_at),
  CONSTRAINT fk_product_attr_run FOREIGN KEY(run_id) REFERENCES ARG_AUDIT_RUN(id) ON DELETE CASCADE
) ENGINE=InnoDB;
