package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
@Getter @Setter
public class AccountSiteUrl extends CrudEntityQuerydsl {
 @Column("id") private Long id;
 @Column("site_id") private Long siteId;
 @Column("audit_id") private Long auditId;
 @Column("created_at") private Instant createdAt;
 @Override public String toString() { return "AccountSiteUrl#" + id; }
}
