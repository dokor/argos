package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;

import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V11. */
public class QAccountOauth extends RelationalPathBase<AccountOauth> {
    public static final QAccountOauth table = new QAccountOauth("ARG_ACCOUNT_OAUTH");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final SimplePath<byte[]> stateHash = createSimple("stateHash", byte[].class);
    public final SimplePath<byte[]> browserHash = createSimple("browserHash", byte[].class);
    public final StringPath provider = createString("provider");
    public final StringPath intent = createString("intent");
    public final NumberPath<Long> userId = createNumber("userId", Long.class);
    public final NumberPath<Long> sessionId = createNumber("sessionId", Long.class);
    public final StringPath nonce = createString("nonce");
    public final StringPath verifier = createString("verifier");
    public final StringPath returnPath = createString("returnPath");
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final DateTimePath<Instant> consumedAt = createDateTime("consumedAt", Instant.class);
    public final PrimaryKey<AccountOauth> primary = createPrimaryKey(id);

    public QAccountOauth(String variable) {
        super(AccountOauth.class, forVariable(variable), null, "ARG_ACCOUNT_OAUTH");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(
                stateHash, ColumnMetadata.named("state_hash").withIndex(2).ofType(Types.BINARY));
        addMetadata(
                browserHash,
                ColumnMetadata.named("browser_hash").withIndex(3).ofType(Types.BINARY));
        addMetadata(provider, ColumnMetadata.named("provider").withIndex(4).ofType(Types.VARCHAR));
        addMetadata(intent, ColumnMetadata.named("intent").withIndex(5).ofType(Types.VARCHAR));
        addMetadata(userId, ColumnMetadata.named("user_id").withIndex(6).ofType(Types.BIGINT));
        addMetadata(
                sessionId, ColumnMetadata.named("session_id").withIndex(7).ofType(Types.BIGINT));
        addMetadata(nonce, ColumnMetadata.named("nonce").withIndex(8).ofType(Types.VARCHAR));
        addMetadata(verifier, ColumnMetadata.named("verifier").withIndex(9).ofType(Types.VARCHAR));
        addMetadata(
                returnPath,
                ColumnMetadata.named("return_path").withIndex(10).ofType(Types.VARCHAR));
        addMetadata(
                expiresAt,
                ColumnMetadata.named("expires_at").withIndex(11).ofType(Types.TIMESTAMP));
        addMetadata(
                consumedAt,
                ColumnMetadata.named("consumed_at").withIndex(12).ofType(Types.TIMESTAMP));
    }
}
