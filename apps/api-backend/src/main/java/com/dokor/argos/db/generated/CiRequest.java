package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
@Getter @Setter
public class CiRequest extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("public_id") private String publicId;
    @Column("owner_user_id") private Long ownerUserId;
    @Column("integration_id") private Long integrationId;
    @Column("idempotency_hash") private byte[] idempotencyHash;
    @Column("request_fingerprint") private byte[] requestFingerprint;
    @Column("navigation_origins") private String navigationOrigins;
    @Column("profile_id") private String profileId;
    @Column("verdict_policy_json") private String verdictPolicyJson;
    @Column("samples") private Integer samples;
    @Column("created_at") private Instant createdAt;
    @Override public String toString(){return "CiRequest#"+id;}
}
