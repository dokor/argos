package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
public class QUsageRun extends RelationalPathBase<UsageRun> {
    public static final QUsageRun table=new QUsageRun("ARG_USAGE_RUN");
    public final NumberPath<Long> id=createNumber("id",Long.class);
    public final NumberPath<Long> userId=createNumber("userId",Long.class);
    public final StringPath period=createString("period"),state=createString("state");
    public final DateTimePath<Instant> createdAt=createDateTime("createdAt",Instant.class),countedAt=createDateTime("countedAt",Instant.class);
    public final DateTimePath<Instant> releasedAt=createDateTime("releasedAt",Instant.class);
    public final PrimaryKey<UsageRun> primary=createPrimaryKey(id);
    public QUsageRun(String variable) {
        super(UsageRun.class,forVariable(variable),null,"ARG_USAGE_RUN");
        addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(userId,ColumnMetadata.named("user_id").ofType(Types.BIGINT));
        addMetadata(period,ColumnMetadata.named("period").ofType(Types.VARCHAR).withSize(7));
        addMetadata(state,ColumnMetadata.named("state").ofType(Types.VARCHAR).withSize(10));
        addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
        addMetadata(releasedAt,ColumnMetadata.named("released_at").ofType(Types.TIMESTAMP));
        addMetadata(countedAt,ColumnMetadata.named("counted_at").ofType(Types.TIMESTAMP));
    }
}
