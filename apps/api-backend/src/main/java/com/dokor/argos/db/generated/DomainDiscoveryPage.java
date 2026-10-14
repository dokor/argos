package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

/** V19 mapping. Generated SQL columns are read-only: use explicit write column lists. */
@Getter @Setter
public class DomainDiscoveryPage extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("discovery_id") private Long discoveryId;
    @Column("owner_user_id") private Long ownerUserId;
    @Column("site_id") private Long siteId;
    @Column("normalized_url") private String normalizedUrl;
    @Column("normalized_url_hash") private byte[] normalizedUrlHash;
    @Column("source") private String source;
    @Column("depth") private Integer depth;
    @Column("eligible") private Boolean eligible;
    @Column("exclusion_reason") private String exclusionReason;
    @Override public String toString() { return "DomainDiscoveryPage#" + id; }
}
