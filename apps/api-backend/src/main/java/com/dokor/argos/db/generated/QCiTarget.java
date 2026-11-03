package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
/** Mapping maintained with V41. */
public class QCiTarget extends RelationalPathBase<CiTarget> {
    public static final QCiTarget table = new QCiTarget("ARG_CI_TARGET");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final StringPath publicId = createString("publicId");
    public final NumberPath<Long> ownerUserId = createNumber("ownerUserId", Long.class);
    public final StringPath origin = createString("origin");
    public final StringPath method = createString("method");
    public final SimplePath<byte[]> challengeHash = createSimple("challengeHash", byte[].class);
    public final DateTimePath<Instant> challengeExpiresAt = createDateTime("challengeExpiresAt", Instant.class);
    public final StringPath state = createString("state");
    public final DateTimePath<Instant> verifiedAt = createDateTime("verifiedAt", Instant.class);
    public final DateTimePath<Instant> validUntil = createDateTime("validUntil", Instant.class);
    public final DateTimePath<Instant> nextCheckAt = createDateTime("nextCheckAt", Instant.class);
    public final NumberPath<Long> generation = createNumber("generation", Long.class);
    public final NumberPath<Long> authorizationEpoch = createNumber("authorizationEpoch", Long.class);
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final PrimaryKey<CiTarget> primary = createPrimaryKey(id);
    public QCiTarget(String variable) {
        super(CiTarget.class, forVariable(variable), null, "ARG_CI_TARGET");
        addMetadata(id, ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(publicId, ColumnMetadata.named("public_id").ofType(Types.VARCHAR));
        addMetadata(ownerUserId, ColumnMetadata.named("owner_user_id").ofType(Types.BIGINT));
        addMetadata(origin, ColumnMetadata.named("origin").ofType(Types.VARCHAR));
        addMetadata(method, ColumnMetadata.named("method").ofType(Types.VARCHAR));
        addMetadata(challengeHash, ColumnMetadata.named("challenge_hash").ofType(Types.BINARY));
        addMetadata(challengeExpiresAt, ColumnMetadata.named("challenge_expires_at").ofType(Types.TIMESTAMP));
        addMetadata(state, ColumnMetadata.named("state").ofType(Types.VARCHAR));
        addMetadata(verifiedAt, ColumnMetadata.named("verified_at").ofType(Types.TIMESTAMP));
        addMetadata(validUntil, ColumnMetadata.named("valid_until").ofType(Types.TIMESTAMP));
        addMetadata(nextCheckAt, ColumnMetadata.named("next_check_at").ofType(Types.TIMESTAMP));
        addMetadata(generation, ColumnMetadata.named("generation").ofType(Types.BIGINT));
        addMetadata(authorizationEpoch, ColumnMetadata.named("authorization_epoch").ofType(Types.BIGINT));
        addMetadata(createdAt, ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
    }
}
