package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V19, including computed read-only columns. */
public class QDomainBatch extends RelationalPathBase<DomainBatch> {
    public static final QDomainBatch table = new QDomainBatch("ARG_DOMAIN_BATCH");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> ownerUserId = createNumber("ownerUserId", Long.class);
    public final NumberPath<Long> siteId = createNumber("siteId", Long.class);
    public final NumberPath<Long> discoveryId = createNumber("discoveryId", Long.class);
    public final StringPath idempotencyKey = createString("idempotencyKey");
    public final ArrayPath<byte[], Byte> requestFingerprint = createArray("requestFingerprint", byte[].class);
    public final StringPath profileId = createString("profileId");
    public final StringPath profileSnapshotJson = createString("profileSnapshotJson");
    public final NumberPath<Integer> selectedCount = createNumber("selectedCount", Integer.class);
    public final StringPath status = createString("status");
    public final BooleanPath cancelRequested = createBoolean("cancelRequested");
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final DateTimePath<Instant> finishedAt = createDateTime("finishedAt", Instant.class);
    public final NumberPath<Long> version = createNumber("version", Long.class);
    public final NumberPath<Long> activeOwnerId = createNumber("activeOwnerId", Long.class);
    public final SimplePath<byte[]> progressFingerprint = createSimple("progressFingerprint", byte[].class);
    public final PrimaryKey<DomainBatch> primary = createPrimaryKey(id);
    public QDomainBatch(String variable) {
        super(DomainBatch.class, forVariable(variable), null, "ARG_DOMAIN_BATCH");
        addMetadata(progressFingerprint, ColumnMetadata.named("progress_fingerprint").withIndex(16).ofType(Types.BINARY));
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).notNull());
        addMetadata(ownerUserId, ColumnMetadata.named("owner_user_id").withIndex(2).ofType(Types.BIGINT).notNull());
        addMetadata(siteId, ColumnMetadata.named("site_id").withIndex(3).ofType(Types.BIGINT).notNull());
        addMetadata(discoveryId, ColumnMetadata.named("discovery_id").withIndex(4).ofType(Types.BIGINT).notNull());
        addMetadata(idempotencyKey, ColumnMetadata.named("idempotency_key").withIndex(5).ofType(Types.VARCHAR).withSize(128).notNull());
        addMetadata(requestFingerprint, ColumnMetadata.named("request_fingerprint").withIndex(6).ofType(Types.BINARY).withSize(32).notNull());
        addMetadata(profileId, ColumnMetadata.named("profile_id").withIndex(7).ofType(Types.VARCHAR).withSize(64).notNull());
        addMetadata(profileSnapshotJson, ColumnMetadata.named("profile_snapshot_json").withIndex(8).ofType(Types.LONGVARCHAR).notNull());
        addMetadata(selectedCount, ColumnMetadata.named("selected_count").withIndex(9).ofType(Types.INTEGER).notNull());
        addMetadata(status, ColumnMetadata.named("status").withIndex(10).ofType(Types.VARCHAR).withSize(16).notNull());
        addMetadata(cancelRequested, ColumnMetadata.named("cancel_requested").withIndex(11).ofType(Types.BOOLEAN).notNull());
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(12).ofType(Types.TIMESTAMP).notNull());
        addMetadata(finishedAt, ColumnMetadata.named("finished_at").withIndex(13).ofType(Types.TIMESTAMP));
        addMetadata(version, ColumnMetadata.named("version").withIndex(14).ofType(Types.BIGINT).notNull());
        addMetadata(activeOwnerId, ColumnMetadata.named("active_owner_id").withIndex(15).ofType(Types.BIGINT));
    }
}
