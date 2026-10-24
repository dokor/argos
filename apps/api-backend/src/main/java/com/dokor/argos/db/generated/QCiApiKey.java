package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
/** V42 mapping. */
public class QCiApiKey extends RelationalPathBase<CiApiKey> {
    public static final QCiApiKey table = new QCiApiKey("ARG_CI_API_KEY");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final StringPath publicId = createString("publicId");
    public final NumberPath<Long> integrationId = createNumber("integrationId", Long.class);
    public final SimplePath<byte[]> secretHash = createSimple("secretHash", byte[].class);
    public final StringPath name = createString("name");
    public final StringPath scopesJson = createString("scopesJson");
    public final StringPath targetsJson = createString("targetsJson");
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final DateTimePath<Instant> overlapUntil = createDateTime("overlapUntil", Instant.class);
    public final DateTimePath<Instant> revokedAt = createDateTime("revokedAt", Instant.class);
    public final DateTimePath<Instant> lastUsedAt = createDateTime("lastUsedAt", Instant.class);
    public final PrimaryKey<CiApiKey> primary = createPrimaryKey(id);
    public QCiApiKey(String variable) {
        super(CiApiKey.class, forVariable(variable), null, "ARG_CI_API_KEY");
        addMetadata(id, ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(publicId, ColumnMetadata.named("public_id").ofType(Types.VARCHAR));
        addMetadata(integrationId, ColumnMetadata.named("integration_id").ofType(Types.BIGINT));
        addMetadata(secretHash, ColumnMetadata.named("secret_hash").ofType(Types.BINARY));
        addMetadata(name, ColumnMetadata.named("name").ofType(Types.VARCHAR));
        addMetadata(scopesJson, ColumnMetadata.named("scopes_json").ofType(Types.VARCHAR));
        addMetadata(targetsJson, ColumnMetadata.named("targets_json").ofType(Types.VARCHAR));
        addMetadata(createdAt, ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
        addMetadata(expiresAt, ColumnMetadata.named("expires_at").ofType(Types.TIMESTAMP));
        addMetadata(overlapUntil, ColumnMetadata.named("overlap_until").ofType(Types.TIMESTAMP));
        addMetadata(revokedAt, ColumnMetadata.named("revoked_at").ofType(Types.TIMESTAMP));
        addMetadata(lastUsedAt, ColumnMetadata.named("last_used_at").ofType(Types.TIMESTAMP));
    }
}
