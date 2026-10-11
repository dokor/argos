package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapping maintained with V11. Never bind this entity to a public request or response. */
@Getter
@Setter
public class AccountOauth extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("state_hash")
    private byte[] stateHash;

    @Column("browser_hash")
    private byte[] browserHash;

    @Column("provider")
    private String provider;

    @Column("intent")
    private String intent;

    @Column("user_id")
    private Long userId;

    @Column("session_id")
    private Long sessionId;

    @Column("nonce")
    private String nonce;

    @Column("verifier")
    private String verifier;

    @Column("return_path")
    private String returnPath;

    @Column("expires_at")
    private Instant expiresAt;

    @Column("consumed_at")
    private Instant consumedAt;

    @Override
    public String toString() {
        return "AccountOauth#" + id;
    }
}
