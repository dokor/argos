package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

/** QueryDSL mapping maintained with V40. */
public class QAccountCiEntitlement extends RelationalPathBase<AccountCiEntitlement> {
    public static final QAccountCiEntitlement table = new QAccountCiEntitlement("ARG_ACCOUNT_CI_ENTITLEMENT");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final BooleanPath ciAccess = createBoolean("ciAccess");
    public final DateTimePath<Instant> validUntil = createDateTime("validUntil", Instant.class);
    public final DateTimePath<Instant> updatedAt = createDateTime("updatedAt", Instant.class);
    public final StringPath grantSource = createString("grantSource");
    public final PrimaryKey<AccountCiEntitlement> primary = createPrimaryKey(id);
    public QAccountCiEntitlement(String variable) {
        super(AccountCiEntitlement.class, forVariable(variable), null, "ARG_ACCOUNT_CI_ENTITLEMENT");
        addMetadata(id, ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(ciAccess, ColumnMetadata.named("ci_access").ofType(Types.BOOLEAN));
        addMetadata(validUntil, ColumnMetadata.named("valid_until").ofType(Types.TIMESTAMP));
        addMetadata(updatedAt, ColumnMetadata.named("updated_at").ofType(Types.TIMESTAMP));
        addMetadata(grantSource, ColumnMetadata.named("grant_source").ofType(Types.VARCHAR));
    }
}
