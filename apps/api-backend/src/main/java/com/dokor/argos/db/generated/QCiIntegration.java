package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
/** V42 mapping. */
public class QCiIntegration extends RelationalPathBase<CiIntegration> {
    public static final QCiIntegration table = new QCiIntegration("ARG_CI_INTEGRATION");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final StringPath publicId = createString("publicId");
    public final NumberPath<Long> ownerUserId = createNumber("ownerUserId", Long.class);
    public final NumberPath<Integer> slot = createNumber("slot", Integer.class);
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final PrimaryKey<CiIntegration> primary = createPrimaryKey(id);
    public QCiIntegration(String variable) {
        super(CiIntegration.class, forVariable(variable), null, "ARG_CI_INTEGRATION");
        addMetadata(id, ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(publicId, ColumnMetadata.named("public_id").ofType(Types.VARCHAR));
        addMetadata(ownerUserId, ColumnMetadata.named("owner_user_id").ofType(Types.BIGINT));
        addMetadata(slot, ColumnMetadata.named("slot").ofType(Types.INTEGER));
        addMetadata(createdAt, ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
    }
}
