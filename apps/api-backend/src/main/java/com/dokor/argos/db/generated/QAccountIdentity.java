package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;

import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V11. */
public class QAccountIdentity extends RelationalPathBase<AccountIdentity> {
    public static final QAccountIdentity table = new QAccountIdentity("ARG_ACCOUNT_IDENTITY");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> userId = createNumber("userId", Long.class);
    public final StringPath provider = createString("provider");
    public final StringPath subject = createString("subject");
    public final StringPath passwordHash = createString("passwordHash");
    public final DateTimePath<Instant> disabledAt = createDateTime("disabledAt", Instant.class);
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final PrimaryKey<AccountIdentity> primary = createPrimaryKey(id);

    public QAccountIdentity(String variable) {
        super(AccountIdentity.class, forVariable(variable), null, "ARG_ACCOUNT_IDENTITY");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(userId, ColumnMetadata.named("user_id").withIndex(2).ofType(Types.BIGINT));
        addMetadata(provider, ColumnMetadata.named("provider").withIndex(3).ofType(Types.VARCHAR));
        addMetadata(subject, ColumnMetadata.named("subject").withIndex(4).ofType(Types.VARCHAR));
        addMetadata(
                passwordHash,
                ColumnMetadata.named("password_hash").withIndex(5).ofType(Types.VARCHAR));
        addMetadata(
                disabledAt,
                ColumnMetadata.named("disabled_at").withIndex(6).ofType(Types.TIMESTAMP));
        addMetadata(
                createdAt, ColumnMetadata.named("created_at").withIndex(7).ofType(Types.TIMESTAMP));
    }
}
