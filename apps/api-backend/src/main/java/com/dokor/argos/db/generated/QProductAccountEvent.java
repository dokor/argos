package com.dokor.argos.db.generated;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;

/** Manually maintained mapping for V37. */
public class QProductAccountEvent extends RelationalPathBase<ProductAccountEvent> {
    public static final QProductAccountEvent table = new QProductAccountEvent("ARG_PRODUCT_ACCOUNT_EVENT");
    public final StringPath eventName = createString("eventName");
    public final NumberPath<Long> subjectId = createNumber("subjectId", Long.class);
    public final StringPath eventKey = createString("eventKey");
    public final NumberPath<Long> userId = createNumber("userId", Long.class);
    public final DateTimePath<java.time.Instant> occurredAt = createDateTime("occurredAt", java.time.Instant.class);
    public final StringPath locale = createString("locale");
    public final StringPath method = createString("method");
    public QProductAccountEvent(String variable) {
        super(ProductAccountEvent.class, forVariable(variable), "null", "ARG_PRODUCT_ACCOUNT_EVENT");
        addMetadata(eventName, ColumnMetadata.named("event_name").withIndex(1).ofType(Types.VARCHAR).withSize(32).notNull());
        addMetadata(subjectId, ColumnMetadata.named("subject_id").withIndex(2).ofType(Types.BIGINT).notNull());
        addMetadata(eventKey, ColumnMetadata.named("event_key").withIndex(3).ofType(Types.VARCHAR).withSize(10).notNull());
        addMetadata(userId, ColumnMetadata.named("user_id").withIndex(4).ofType(Types.BIGINT).notNull());
        addMetadata(occurredAt, ColumnMetadata.named("occurred_at").withIndex(5).ofType(Types.TIMESTAMP).notNull());
        addMetadata(locale, ColumnMetadata.named("locale").withIndex(6).ofType(Types.CHAR).withSize(2).notNull());
        addMetadata(method, ColumnMetadata.named("method").withIndex(7).ofType(Types.VARCHAR).withSize(16).notNull());
    }
}
