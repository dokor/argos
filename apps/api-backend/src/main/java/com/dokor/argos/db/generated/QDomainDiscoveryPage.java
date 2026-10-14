package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V19, including computed read-only columns. */
public class QDomainDiscoveryPage extends RelationalPathBase<DomainDiscoveryPage> {
    public static final QDomainDiscoveryPage table = new QDomainDiscoveryPage("ARG_DOMAIN_DISCOVERY_PAGE");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> discoveryId = createNumber("discoveryId", Long.class);
    public final NumberPath<Long> ownerUserId = createNumber("ownerUserId", Long.class);
    public final NumberPath<Long> siteId = createNumber("siteId", Long.class);
    public final StringPath normalizedUrl = createString("normalizedUrl");
    public final ArrayPath<byte[], Byte> normalizedUrlHash = createArray("normalizedUrlHash", byte[].class);
    public final StringPath source = createString("source");
    public final NumberPath<Integer> depth = createNumber("depth", Integer.class);
    public final BooleanPath eligible = createBoolean("eligible");
    public final StringPath exclusionReason = createString("exclusionReason");
    public final PrimaryKey<DomainDiscoveryPage> primary = createPrimaryKey(id);
    public QDomainDiscoveryPage(String variable) {
        super(DomainDiscoveryPage.class, forVariable(variable), null, "ARG_DOMAIN_DISCOVERY_PAGE");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).notNull());
        addMetadata(discoveryId, ColumnMetadata.named("discovery_id").withIndex(2).ofType(Types.BIGINT).notNull());
        addMetadata(ownerUserId, ColumnMetadata.named("owner_user_id").withIndex(3).ofType(Types.BIGINT).notNull());
        addMetadata(siteId, ColumnMetadata.named("site_id").withIndex(4).ofType(Types.BIGINT).notNull());
        addMetadata(normalizedUrl, ColumnMetadata.named("normalized_url").withIndex(5).ofType(Types.VARCHAR).withSize(2048).notNull());
        addMetadata(normalizedUrlHash, ColumnMetadata.named("normalized_url_hash").withIndex(6).ofType(Types.BINARY).withSize(32));
        addMetadata(source, ColumnMetadata.named("source").withIndex(7).ofType(Types.VARCHAR).withSize(16).notNull());
        addMetadata(depth, ColumnMetadata.named("depth").withIndex(8).ofType(Types.INTEGER).notNull());
        addMetadata(eligible, ColumnMetadata.named("eligible").withIndex(9).ofType(Types.BOOLEAN).notNull());
        addMetadata(exclusionReason, ColumnMetadata.named("exclusion_reason").withIndex(10).ofType(Types.VARCHAR).withSize(64));
    }
}
