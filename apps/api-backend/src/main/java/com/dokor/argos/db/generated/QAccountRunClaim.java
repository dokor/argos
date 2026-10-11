package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;

import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V11. */
public class QAccountRunClaim extends RelationalPathBase<AccountRunClaim> {
    public static final QAccountRunClaim table = new QAccountRunClaim("ARG_ACCOUNT_RUN_CLAIM");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> runId = createNumber("runId", Long.class);
    public final SimplePath<byte[]> proofHash = createSimple("proofHash", byte[].class);
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final NumberPath<Long> consumedBy = createNumber("consumedBy", Long.class);
    public final PrimaryKey<AccountRunClaim> primary = createPrimaryKey(id);

    public QAccountRunClaim(String variable) {
        super(AccountRunClaim.class, forVariable(variable), null, "ARG_ACCOUNT_RUN_CLAIM");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(runId, ColumnMetadata.named("run_id").withIndex(2).ofType(Types.BIGINT));
        addMetadata(
                proofHash, ColumnMetadata.named("proof_hash").withIndex(3).ofType(Types.BINARY));
        addMetadata(
                expiresAt, ColumnMetadata.named("expires_at").withIndex(4).ofType(Types.TIMESTAMP));
        addMetadata(
                consumedBy, ColumnMetadata.named("consumed_by").withIndex(5).ofType(Types.BIGINT));
    }
}
