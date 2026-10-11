package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapping maintained with V11. Never bind this entity to a public request or response. */
@Getter
@Setter
public class AccountSession extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("user_id")
    private Long userId;

    @Column("csrf_hash")
    private byte[] csrfHash;

    @Column("created_at")
    private Instant createdAt;

    @Column("authenticated_at")
    private Instant authenticatedAt;

    @Column("last_activity_at")
    private Instant lastActivityAt;

    @Column("expires_at")
    private Instant expiresAt;

    @Column("revoked_at")
    private Instant revokedAt;

    @Override
    public String toString() {
        return "AccountSession#" + id;
    }
}
