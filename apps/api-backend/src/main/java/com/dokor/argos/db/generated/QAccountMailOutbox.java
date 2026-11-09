package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V40. */
public class QAccountMailOutbox extends RelationalPathBase<AccountMailOutbox> {
    public static final QAccountMailOutbox table = new QAccountMailOutbox("ARG_ACCOUNT_MAIL_OUTBOX");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Long> tokenId = createNumber("tokenId", Long.class);
    public final SimplePath<byte[]> payload = createSimple("payload", byte[].class);
    public final NumberPath<Integer> attempts = createNumber("attempts", Integer.class);
    public final StringPath claimToken = createString("claimToken");
    public final DateTimePath<Instant> nextAttemptAt = createDateTime("nextAttemptAt", Instant.class);
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final PrimaryKey<AccountMailOutbox> primary = createPrimaryKey(id);

    public QAccountMailOutbox(String variable) {
        super(AccountMailOutbox.class, forVariable(variable), null, "ARG_ACCOUNT_MAIL_OUTBOX");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT));
        addMetadata(tokenId, ColumnMetadata.named("token_id").withIndex(2).ofType(Types.BIGINT));
        addMetadata(payload, ColumnMetadata.named("payload").withIndex(3).ofType(Types.VARBINARY));
        addMetadata(attempts, ColumnMetadata.named("attempts").withIndex(4).ofType(Types.INTEGER));
        addMetadata(claimToken, ColumnMetadata.named("claim_token").withIndex(5).ofType(Types.VARCHAR));
        addMetadata(nextAttemptAt, ColumnMetadata.named("next_attempt_at").withIndex(6).ofType(Types.TIMESTAMP));
        addMetadata(expiresAt, ColumnMetadata.named("expires_at").withIndex(7).ofType(Types.TIMESTAMP));
    }
}

