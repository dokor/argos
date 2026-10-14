package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
public class QDiscoveryGate extends RelationalPathBase<DiscoveryGate> {
    public static final QDiscoveryGate table=new QDiscoveryGate("ARG_DISCOVERY_GATE");
    public final NumberPath<Long> id=createNumber("id",Long.class);
    public final PrimaryKey<DiscoveryGate> primary=createPrimaryKey(id);
    public QDiscoveryGate(String variable){super(DiscoveryGate.class,forVariable(variable),null,"ARG_DISCOVERY_GATE");addMetadata(id,ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).notNull());}
}
