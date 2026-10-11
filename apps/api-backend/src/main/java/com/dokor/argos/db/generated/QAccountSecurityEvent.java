package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;

import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V11. */
public class QAccountSecurityEvent extends RelationalPathBase<AccountSecurityEvent> {
    public static final QAccountSecurityEvent table =
            new QAccountSecurityEvent("ARG_ACCOUNT_SECURITY_EVENT");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> userId = createNumber("userId", Long.class);
    public final NumberPath<Long> sessionId = createNumber("sessionId", Long.class);
    public final StringPath action = createString("action");
    public final StringPath outcome = createString("outcome");
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final PrimaryKey<AccountSecurityEvent> primary = createPrimaryKey(id);

    public QAccountSecurityEvent(String variable) {
        super(
                AccountSecurityEvent.class,
                forVariable(variable),
                null,
                "ARG_ACCOUNT_SECURITY_EVENT");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(userId, ColumnMetadata.named("user_id").withIndex(2).ofType(Types.BIGINT));
        addMetadata(
                sessionId, ColumnMetadata.named("session_id").withIndex(3).ofType(Types.BIGINT));
        addMetadata(action, ColumnMetadata.named("action").withIndex(4).ofType(Types.VARCHAR));
        addMetadata(outcome, ColumnMetadata.named("outcome").withIndex(5).ofType(Types.VARCHAR));
        addMetadata(
                createdAt, ColumnMetadata.named("created_at").withIndex(6).ofType(Types.TIMESTAMP));
    }
}
