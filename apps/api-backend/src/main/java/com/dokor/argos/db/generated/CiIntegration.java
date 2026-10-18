package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
/** V42 server entity. Never bind to public payloads. */
@Getter @Setter
public class CiIntegration extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("public_id") private String publicId;
    @Column("owner_user_id") private Long ownerUserId;
    @Column("slot") private Integer slot;
    @Column("created_at") private Instant createdAt;
    @Override public String toString() { return "CiIntegration#" + id; }
}
