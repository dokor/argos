package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Getter @Setter
public class ProductSetting extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("enabled") private Boolean enabled;
    @Column("version") private Long version;
    @Column("enabled_since") private Instant enabledSince;
    @Column("last_collected_at") private Instant lastCollectedAt;
}
