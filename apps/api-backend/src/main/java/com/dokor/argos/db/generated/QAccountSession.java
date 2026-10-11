package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;

import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V11. */
public class QAccountSession extends RelationalPathBase<AccountSession> {
    public static final QAccountSession table = new QAccountSession("ARG_ACCOUNT_SESSION");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> userId = createNumber("userId", Long.class);
    public final SimplePath<byte[]> csrfHash = createSimple("csrfHash", byte[].class);
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final DateTimePath<Instant> authenticatedAt =
            createDateTime("authenticatedAt", Instant.class);
    public final DateTimePath<Instant> lastActivityAt =
            createDateTime("lastActivityAt", Instant.class);
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final DateTimePath<Instant> revokedAt = createDateTime("revokedAt", Instant.class);
    public final PrimaryKey<AccountSession> primary = createPrimaryKey(id);

    public QAccountSession(String variable) {
        super(AccountSession.class, forVariable(variable), null, "ARG_ACCOUNT_SESSION");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(userId, ColumnMetadata.named("user_id").withIndex(2).ofType(Types.BIGINT));
        addMetadata(csrfHash, ColumnMetadata.named("csrf_hash").withIndex(3).ofType(Types.BINARY));
        addMetadata(
                createdAt, ColumnMetadata.named("created_at").withIndex(4).ofType(Types.TIMESTAMP));
        addMetadata(
                authenticatedAt,
                ColumnMetadata.named("authenticated_at").withIndex(5).ofType(Types.TIMESTAMP));
        addMetadata(
                lastActivityAt,
                ColumnMetadata.named("last_activity_at").withIndex(6).ofType(Types.TIMESTAMP));
        addMetadata(
                expiresAt, ColumnMetadata.named("expires_at").withIndex(7).ofType(Types.TIMESTAMP));
        addMetadata(
                revokedAt, ColumnMetadata.named("revoked_at").withIndex(8).ofType(Types.TIMESTAMP));
    }
}
