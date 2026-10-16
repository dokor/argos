package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

public class QProductSetting extends RelationalPathBase<ProductSetting> {
    public static final QProductSetting table = new QProductSetting("ARG_PRODUCT_SETTING");
    public final NumberPath<Long> id = createNumber("id", Long.class), version = createNumber("version", Long.class);
    public final BooleanPath enabled = createBoolean("enabled");
    public final DateTimePath<Instant> enabledSince = createDateTime("enabledSince", Instant.class), lastCollectedAt = createDateTime("lastCollectedAt", Instant.class);
    public final PrimaryKey<ProductSetting> primary = createPrimaryKey(id);
    public QProductSetting(String variable) {
        super(ProductSetting.class, forVariable(variable), null, "ARG_PRODUCT_SETTING");
        addMetadata(id, ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(version, ColumnMetadata.named("version").ofType(Types.BIGINT));
        addMetadata(enabled, ColumnMetadata.named("enabled").ofType(Types.BOOLEAN));
        addMetadata(enabledSince, ColumnMetadata.named("enabled_since").ofType(Types.TIMESTAMP));
        addMetadata(lastCollectedAt, ColumnMetadata.named("last_collected_at").ofType(Types.TIMESTAMP));
    }
}
