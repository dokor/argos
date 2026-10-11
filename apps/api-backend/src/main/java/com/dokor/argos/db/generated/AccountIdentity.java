package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapping maintained with V11. Never bind this entity to a public request or response. */
@Getter
@Setter
public class AccountIdentity extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("user_id")
    private Long userId;

    @Column("provider")
    private String provider;

    @Column("subject")
    private String subject;

    @Column("password_hash")
    private String passwordHash;

    @Column("disabled_at")
    private Instant disabledAt;

    @Column("created_at")
    private Instant createdAt;

    @Override
    public String toString() {
        return "AccountIdentity#" + id;
    }
}
