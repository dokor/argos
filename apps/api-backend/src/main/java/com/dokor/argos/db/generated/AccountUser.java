package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapping maintained with V11. Never bind this entity to a public request or response. */
@Getter
@Setter
public class AccountUser extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("email")
    private String email;

    @Column("display_name")
    private String displayName;

    @Column("state")
    private String state;

    @Column("role")
    private String role;

    @Column("offer")
    private String offer;

    @Column("created_at")
    private Instant createdAt;

    @Column("archived_at")
    private Instant archivedAt;

    @Column("admin_version")
    private Long adminVersion = 0L;

    @Column("suspended_from")
    private String suspendedFrom;

    @Override
    public String toString() {
        return "AccountUser#" + id;
    }
}
