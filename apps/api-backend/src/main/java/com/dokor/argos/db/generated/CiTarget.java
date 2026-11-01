package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
/** V41. Server-only proof hashes; never serialize this entity. */
@Getter @Setter
public class CiTarget extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("public_id") private String publicId;
    @Column("owner_user_id") private Long ownerUserId;
    @Column("origin") private String origin;
    @Column("method") private String method;
    @Column("challenge_hash") private byte[] challengeHash;
    @Column("challenge_expires_at") private Instant challengeExpiresAt;
    @Column("state") private String state;
    @Column("verified_at") private Instant verifiedAt;
    @Column("valid_until") private Instant validUntil;
    @Column("next_check_at") private Instant nextCheckAt;
    @Column("generation") private Long generation;
    @Column("authorization_epoch") private Long authorizationEpoch;
    @Column("created_at") private Instant createdAt;
    @Override public String toString() { return "CiTarget#" + id; }
}
