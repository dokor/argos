package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapping maintained with V11. Never bind this entity to a public request or response. */
@Getter
@Setter
public class AccountToken extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("user_id")
    private Long userId;

    @Column("session_id")
    private Long sessionId;

    @Column("token_hash")
    private byte[] tokenHash;

    @Column("purpose")
    private String purpose;

    @Column("email")
    private String email;

    @Column("expires_at")
    private Instant expiresAt;

    @Column("consumed_at")
    private Instant consumedAt;

    @Override
    public String toString() {
        return "AccountToken#" + id;
    }
}
