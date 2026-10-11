package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
@Getter @Setter
public class AccountSite extends CrudEntityQuerydsl {
 @Column("id") private Long id;
 @Column("owner_user_id") private Long ownerUserId;
 @Column("domain_id") private Long domainId;
 @Column("created_at") private Instant createdAt;
 @Override public String toString() { return "AccountSite#" + id; }
}
