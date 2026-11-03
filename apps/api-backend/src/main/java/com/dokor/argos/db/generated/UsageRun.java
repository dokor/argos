package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
@Getter @Setter
public class UsageRun extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("user_id") private Long userId;
    @Column("period") private String period;
    @Column("state") private String state;
    @Column("created_at") private Instant createdAt;
    @Column("released_at") private Instant releasedAt;
    @Column("counted_at") private Instant countedAt;
    @Column("ci_integration_id") private Long ciIntegrationId;
    @Column("ci_target_hash") private byte[] ciTargetHash;
    @Column("ci_intent_id") private String ciIntentId;
    @Column("ci_sample") private Integer ciSample;
    @Column("ci_started_at") private Instant ciStartedAt;
    @Override public String toString() { return "UsageRun#"+id; }
}
