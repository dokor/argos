package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapping maintained with V11. Never bind this entity to a public request or response. */
@Getter
@Setter
public class AccountSecurityEvent extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("user_id")
    private Long userId;

    @Column("session_id")
    private Long sessionId;

    @Column("action")
    private String action;

    @Column("outcome")
    private String outcome;

    @Column("created_at")
    private Instant createdAt;

    @Override
    public String toString() {
        return "AccountSecurityEvent#" + id;
    }
}
