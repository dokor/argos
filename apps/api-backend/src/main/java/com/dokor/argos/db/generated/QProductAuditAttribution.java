package com.dokor.argos.db.generated;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
/** Manually maintained query mapping for V10. */
public class QProductAuditAttribution extends RelationalPathBase<ProductAuditAttribution> {
    public static final QProductAuditAttribution productAuditAttribution=new QProductAuditAttribution("ARG_PRODUCT_AUDIT_ATTR");
    public final NumberPath<Long> runId=createNumber("runId",Long.class);
    public final StringPath sourceRoute=createString("sourceRoute");
    public final StringPath locale=createString("locale");
    public final StringPath placement=createString("placement");
    public final DateTimePath<java.time.Instant> createdAt=createDateTime("createdAt",java.time.Instant.class);
    public final DateTimePath<java.time.Instant> firstViewedAt=createDateTime("firstViewedAt",java.time.Instant.class);
    public QProductAuditAttribution(String variable){super(ProductAuditAttribution.class,forVariable(variable),"null","ARG_PRODUCT_AUDIT_ATTR");
        addMetadata(runId,ColumnMetadata.named("run_id").withIndex(1).ofType(Types.BIGINT).notNull());
        addMetadata(sourceRoute,ColumnMetadata.named("source_route").withIndex(2).ofType(Types.VARCHAR).withSize(80).notNull());
        addMetadata(locale,ColumnMetadata.named("locale").withIndex(3).ofType(Types.CHAR).withSize(2).notNull());
        addMetadata(placement,ColumnMetadata.named("placement").withIndex(4).ofType(Types.VARCHAR).withSize(16).notNull());
        addMetadata(createdAt,ColumnMetadata.named("created_at").withIndex(5).ofType(Types.TIMESTAMP).notNull());
        addMetadata(firstViewedAt,ColumnMetadata.named("first_viewed_at").withIndex(6).ofType(Types.TIMESTAMP));
    }
}
