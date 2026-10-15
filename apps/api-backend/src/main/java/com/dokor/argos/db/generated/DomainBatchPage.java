package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

/** V19 mapping. Generated SQL columns are read-only: use explicit write column lists. */
@Getter @Setter
public class DomainBatchPage extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("batch_id") private Long batchId;
    @Column("owner_user_id") private Long ownerUserId;
    @Column("site_id") private Long siteId;
    @Column("discovery_id") private Long discoveryId;
    @Column("discovery_page_id") private Long discoveryPageId;
    @Column("audit_id") private Long auditId;
    @Column("run_id") private Long runId;
    @Column("completeness") private String completeness;
    @Column("created_at") private Instant createdAt;
    @Override public String toString() { return "DomainBatchPage#" + id; }
}
