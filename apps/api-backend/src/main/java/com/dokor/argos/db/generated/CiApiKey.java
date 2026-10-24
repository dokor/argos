package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
/** V42 server entity. Never bind to public payloads. */
@Getter @Setter
public class CiApiKey extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("public_id") private String publicId;
    @Column("integration_id") private Long integrationId;
    @Column("secret_hash") private byte[] secretHash;
    @Column("name") private String name;
    @Column("scopes_json") private String scopesJson;
    @Column("targets_json") private String targetsJson;
    @Column("created_at") private Instant createdAt;
    @Column("expires_at") private Instant expiresAt;
    @Column("overlap_until") private Instant overlapUntil;
    @Column("revoked_at") private Instant revokedAt;
    @Column("last_used_at") private Instant lastUsedAt;
    @Override public String toString() { return "CiApiKey#" + id; }
}
