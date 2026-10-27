-- Explicit server entitlement: an offer or an administrator role alone grants no CI access.
-- No backfill grants access, including to the internal self-audit account.
CREATE TABLE ARG_ACCOUNT_CI_ENTITLEMENT (
 id BIGINT NOT NULL PRIMARY KEY,
 ci_access BOOLEAN NOT NULL DEFAULT FALSE,
 valid_until DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 CONSTRAINT fk_ci_entitlement_user FOREIGN KEY(id) REFERENCES ARG_ACCOUNT_USER(id),
 CONSTRAINT ck_ci_access CHECK(ci_access IN (0,1))
) ENGINE=InnoDB;
