package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;

import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V11. */
public class QAccountUser extends RelationalPathBase<AccountUser> {
    public static final QAccountUser table = new QAccountUser("ARG_ACCOUNT_USER");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final StringPath email = createString("email");
    public final StringPath displayName = createString("displayName");
    public final StringPath state = createString("state");
    public final StringPath role = createString("role");
    public final StringPath offer = createString("offer");
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final DateTimePath<Instant> archivedAt = createDateTime("archivedAt", Instant.class);
    public final PrimaryKey<AccountUser> primary = createPrimaryKey(id);

    public QAccountUser(String variable) {
        super(AccountUser.class, forVariable(variable), null, "ARG_ACCOUNT_USER");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(email, ColumnMetadata.named("email").withIndex(2).ofType(Types.VARCHAR));
        addMetadata(
                displayName,
                ColumnMetadata.named("display_name").withIndex(3).ofType(Types.VARCHAR));
        addMetadata(state, ColumnMetadata.named("state").withIndex(4).ofType(Types.VARCHAR));
        addMetadata(role, ColumnMetadata.named("role").withIndex(5).ofType(Types.VARCHAR));
        addMetadata(offer, ColumnMetadata.named("offer").withIndex(6).ofType(Types.VARCHAR));
        addMetadata(
                createdAt, ColumnMetadata.named("created_at").withIndex(7).ofType(Types.TIMESTAMP));
        addMetadata(
                archivedAt,
                ColumnMetadata.named("archived_at").withIndex(8).ofType(Types.TIMESTAMP));
    }
}
