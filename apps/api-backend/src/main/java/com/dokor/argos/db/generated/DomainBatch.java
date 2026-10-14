package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

/** V19 mapping. Generated SQL columns are read-only: use explicit write column lists. */
@Getter @Setter
public class DomainBatch extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("owner_user_id") private Long ownerUserId;
    @Column("site_id") private Long siteId;
    @Column("discovery_id") private Long discoveryId;
    @Column("idempotency_key") private String idempotencyKey;
    @Column("request_fingerprint") private byte[] requestFingerprint;
    @Column("profile_id") private String profileId;
    @Column("profile_snapshot_json") private String profileSnapshotJson;
    @Column("selected_count") private Integer selectedCount;
    @Column("status") private String status;
    @Column("cancel_requested") private Boolean cancelRequested;
    @Column("created_at") private Instant createdAt;
    @Column("finished_at") private Instant finishedAt;
    @Column("version") private Long version;
    @Column("active_owner_id") private Long activeOwnerId;
    @Override public String toString() { return "DomainBatch#" + id; }
}
