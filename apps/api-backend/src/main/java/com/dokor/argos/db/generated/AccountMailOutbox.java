package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

/** Private encrypted mail queue, maintained with V40. Never expose through the API. */
@Getter
@Setter
public class AccountMailOutbox extends CrudEntityQuerydsl {
    @Column("id")
    private Long id;

    @Column("token_id")
    private Long tokenId;

    @Column("payload")
    private byte[] payload;

    @Column("attempts")
    private Integer attempts;

    @Column("claim_token")
    private String claimToken;

    @Column("next_attempt_at")
    private Instant nextAttemptAt;

    @Column("expires_at")
    private Instant expiresAt;

    @Override
    public String toString() { return "AccountMailOutbox#" + id; }
}

