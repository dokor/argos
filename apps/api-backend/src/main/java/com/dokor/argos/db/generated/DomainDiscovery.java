package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

/** V19/V22 mapping. Generated SQL columns are read-only: use explicit write column lists. */
@Getter @Setter
public class DomainDiscovery extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("owner_user_id") private Long ownerUserId;
    @Column("site_id") private Long siteId;
    @Column("idempotency_key") private String idempotencyKey;
    @Column("request_fingerprint") private byte[] requestFingerprint;
    @Column("status") private String status;
    @Column("parameters_json") private String parametersJson;
    @Column("effective_limits_json") private String effectiveLimitsJson;
    @Column("created_at") private Instant createdAt;
    @Column("finished_at") private Instant finishedAt;
    @Column("expires_at") private Instant expiresAt;
    @Column("eligible_count") private Integer eligibleCount;
    @Column("excluded_count") private Integer excludedCount;
    @Column("truncated") private Boolean truncated;
    @Column("cancel_requested") private Boolean cancelRequested;
    @Column("stop_reason") private String stopReason;
    @Column("version") private Long version;
    @Column("active_owner_id") private Long activeOwnerId;
    @Column("started_at") private Instant startedAt;
    @Column("lease_until") private Instant leaseUntil;
    @Column("claim_token") private String claimToken;
    @Override public String toString() { return "DomainDiscovery#" + id; }
}
