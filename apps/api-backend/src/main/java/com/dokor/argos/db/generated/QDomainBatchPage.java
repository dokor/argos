package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V19, including computed read-only columns. */
public class QDomainBatchPage extends RelationalPathBase<DomainBatchPage> {
    public static final QDomainBatchPage table = new QDomainBatchPage("ARG_DOMAIN_BATCH_PAGE");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> batchId = createNumber("batchId", Long.class);
    public final NumberPath<Long> ownerUserId = createNumber("ownerUserId", Long.class);
    public final NumberPath<Long> siteId = createNumber("siteId", Long.class);
    public final NumberPath<Long> discoveryId = createNumber("discoveryId", Long.class);
    public final NumberPath<Long> discoveryPageId = createNumber("discoveryPageId", Long.class);
    public final NumberPath<Long> auditId = createNumber("auditId", Long.class);
    public final NumberPath<Long> runId = createNumber("runId", Long.class);
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final StringPath completeness = createString("completeness");
    public final PrimaryKey<DomainBatchPage> primary = createPrimaryKey(id);
    public QDomainBatchPage(String variable) {
        super(DomainBatchPage.class, forVariable(variable), null, "ARG_DOMAIN_BATCH_PAGE");
        addMetadata(completeness, ColumnMetadata.named("completeness").withIndex(10).ofType(Types.VARCHAR).notNull());
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).notNull());
        addMetadata(batchId, ColumnMetadata.named("batch_id").withIndex(2).ofType(Types.BIGINT).notNull());
        addMetadata(ownerUserId, ColumnMetadata.named("owner_user_id").withIndex(3).ofType(Types.BIGINT).notNull());
        addMetadata(siteId, ColumnMetadata.named("site_id").withIndex(4).ofType(Types.BIGINT).notNull());
        addMetadata(discoveryId, ColumnMetadata.named("discovery_id").withIndex(5).ofType(Types.BIGINT).notNull());
        addMetadata(discoveryPageId, ColumnMetadata.named("discovery_page_id").withIndex(6).ofType(Types.BIGINT).notNull());
        addMetadata(auditId, ColumnMetadata.named("audit_id").withIndex(7).ofType(Types.BIGINT).notNull());
        addMetadata(runId, ColumnMetadata.named("run_id").withIndex(8).ofType(Types.BIGINT).notNull());
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(9).ofType(Types.TIMESTAMP).notNull());
    }
}
