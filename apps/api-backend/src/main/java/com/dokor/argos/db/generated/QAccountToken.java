package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;

import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V11. */
public class QAccountToken extends RelationalPathBase<AccountToken> {
    public static final QAccountToken table = new QAccountToken("ARG_ACCOUNT_TOKEN");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> userId = createNumber("userId", Long.class);
    public final NumberPath<Long> sessionId = createNumber("sessionId", Long.class);
    public final SimplePath<byte[]> tokenHash = createSimple("tokenHash", byte[].class);
    public final StringPath purpose = createString("purpose");
    public final StringPath email = createString("email");
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final DateTimePath<Instant> consumedAt = createDateTime("consumedAt", Instant.class);
    public final PrimaryKey<AccountToken> primary = createPrimaryKey(id);

    public QAccountToken(String variable) {
        super(AccountToken.class, forVariable(variable), null, "ARG_ACCOUNT_TOKEN");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(userId, ColumnMetadata.named("user_id").withIndex(2).ofType(Types.BIGINT));
        addMetadata(
                sessionId, ColumnMetadata.named("session_id").withIndex(3).ofType(Types.BIGINT));
        addMetadata(
                tokenHash, ColumnMetadata.named("token_hash").withIndex(4).ofType(Types.BINARY));
        addMetadata(purpose, ColumnMetadata.named("purpose").withIndex(5).ofType(Types.VARCHAR));
        addMetadata(email, ColumnMetadata.named("email").withIndex(6).ofType(Types.VARCHAR));
        addMetadata(
                expiresAt, ColumnMetadata.named("expires_at").withIndex(7).ofType(Types.TIMESTAMP));
        addMetadata(
                consumedAt,
                ColumnMetadata.named("consumed_at").withIndex(8).ofType(Types.TIMESTAMP));
    }
}
