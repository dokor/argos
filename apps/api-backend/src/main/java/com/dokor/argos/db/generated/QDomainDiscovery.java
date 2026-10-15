package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V19, including computed read-only columns. */
public class QDomainDiscovery extends RelationalPathBase<DomainDiscovery> {
    public static final QDomainDiscovery table = new QDomainDiscovery("ARG_DOMAIN_DISCOVERY");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> ownerUserId = createNumber("ownerUserId", Long.class);
    public final NumberPath<Long> siteId = createNumber("siteId", Long.class);
    public final StringPath idempotencyKey = createString("idempotencyKey");
    public final ArrayPath<byte[], Byte> requestFingerprint = createArray("requestFingerprint", byte[].class);
    public final StringPath status = createString("status");
    public final StringPath parametersJson = createString("parametersJson");
    public final StringPath effectiveLimitsJson = createString("effectiveLimitsJson");
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final DateTimePath<Instant> finishedAt = createDateTime("finishedAt", Instant.class);
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final NumberPath<Integer> eligibleCount = createNumber("eligibleCount", Integer.class);
    public final NumberPath<Integer> excludedCount = createNumber("excludedCount", Integer.class);
    public final BooleanPath truncated = createBoolean("truncated");
    public final BooleanPath cancelRequested = createBoolean("cancelRequested");
    public final StringPath stopReason = createString("stopReason");
    public final NumberPath<Long> version = createNumber("version", Long.class);
    public final NumberPath<Long> activeOwnerId = createNumber("activeOwnerId", Long.class);
    public final DateTimePath<Instant> startedAt = createDateTime("startedAt", Instant.class);
    public final DateTimePath<Instant> leaseUntil = createDateTime("leaseUntil", Instant.class);
    public final StringPath claimToken = createString("claimToken");
    public final PrimaryKey<DomainDiscovery> primary = createPrimaryKey(id);
    public QDomainDiscovery(String variable) {
        super(DomainDiscovery.class, forVariable(variable), null, "ARG_DOMAIN_DISCOVERY");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).notNull());
        addMetadata(ownerUserId, ColumnMetadata.named("owner_user_id").withIndex(2).ofType(Types.BIGINT).notNull());
        addMetadata(siteId, ColumnMetadata.named("site_id").withIndex(3).ofType(Types.BIGINT).notNull());
        addMetadata(idempotencyKey, ColumnMetadata.named("idempotency_key").withIndex(4).ofType(Types.VARCHAR).withSize(128).notNull());
        addMetadata(requestFingerprint, ColumnMetadata.named("request_fingerprint").withIndex(5).ofType(Types.BINARY).withSize(32).notNull());
        addMetadata(status, ColumnMetadata.named("status").withIndex(6).ofType(Types.VARCHAR).withSize(16).notNull());
        addMetadata(parametersJson, ColumnMetadata.named("parameters_json").withIndex(7).ofType(Types.LONGVARCHAR).notNull());
        addMetadata(effectiveLimitsJson, ColumnMetadata.named("effective_limits_json").withIndex(8).ofType(Types.LONGVARCHAR).notNull());
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(9).ofType(Types.TIMESTAMP).notNull());
        addMetadata(finishedAt, ColumnMetadata.named("finished_at").withIndex(10).ofType(Types.TIMESTAMP));
        addMetadata(expiresAt, ColumnMetadata.named("expires_at").withIndex(11).ofType(Types.TIMESTAMP).notNull());
        addMetadata(eligibleCount, ColumnMetadata.named("eligible_count").withIndex(12).ofType(Types.INTEGER).notNull());
        addMetadata(excludedCount, ColumnMetadata.named("excluded_count").withIndex(13).ofType(Types.INTEGER).notNull());
        addMetadata(truncated, ColumnMetadata.named("truncated").withIndex(14).ofType(Types.BOOLEAN).notNull());
        addMetadata(cancelRequested, ColumnMetadata.named("cancel_requested").withIndex(15).ofType(Types.BOOLEAN).notNull());
        addMetadata(stopReason, ColumnMetadata.named("stop_reason").withIndex(16).ofType(Types.VARCHAR).withSize(64));
        addMetadata(version, ColumnMetadata.named("version").withIndex(17).ofType(Types.BIGINT).notNull());
        addMetadata(startedAt, ColumnMetadata.named("started_at").withIndex(19).ofType(Types.TIMESTAMP));
        addMetadata(leaseUntil, ColumnMetadata.named("lease_until").withIndex(20).ofType(Types.TIMESTAMP));
        addMetadata(claimToken, ColumnMetadata.named("claim_token").withIndex(21).ofType(Types.VARCHAR).withSize(36));
        addMetadata(activeOwnerId, ColumnMetadata.named("active_owner_id").withIndex(18).ofType(Types.BIGINT));
    }
}
