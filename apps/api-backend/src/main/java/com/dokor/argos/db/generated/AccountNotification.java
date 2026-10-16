package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
@Getter @Setter
public class AccountNotification extends CrudEntityQuerydsl {
 @Column("id") private Long id;
 @Column("owner_user_id") private Long ownerUserId;
 @Column("event_key") private String eventKey;
 @Column("type") private String type;
 @Column("entity_id") private Long entityId;
 @Column("site_id") private Long siteId;
 @Column("hostname") private String hostname;
 @Column("item_count") private Integer itemCount;
 @Column("created_at") private Instant createdAt;
 @Column("read_at") private Instant readAt;
 @Override public String toString(){return "AccountNotification#"+id;}
}
