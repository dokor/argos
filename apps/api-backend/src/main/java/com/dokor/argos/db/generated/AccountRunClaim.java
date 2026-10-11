package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapping maintained with V11. Never bind this entity to a public request or response. */
@Getter
@Setter
public class AccountRunClaim extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("run_id")
    private Long runId;

    @Column("proof_hash")
    private byte[] proofHash;

    @Column("expires_at")
    private Instant expiresAt;

    @Column("consumed_by")
    private Long consumedBy;

    @Override
    public String toString() {
        return "AccountRunClaim#" + id;
    }
}
