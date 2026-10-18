package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** V40 server-only grant; never bind this entity to a client payload. */
@Getter @Setter
public class AccountCiEntitlement extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("ci_access") private Boolean ciAccess;
    @Column("valid_until") private Instant validUntil;
    @Column("updated_at") private Instant updatedAt;
    @Override public String toString() { return "AccountCiEntitlement#" + id; }
}
