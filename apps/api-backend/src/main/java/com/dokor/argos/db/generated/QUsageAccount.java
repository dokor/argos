package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
public class QUsageAccount extends RelationalPathBase<UsageAccount> {
    public static final QUsageAccount table=new QUsageAccount("ARG_USAGE_ACCOUNT");
    public final NumberPath<Long> id=createNumber("id",Long.class);
    public final PrimaryKey<UsageAccount> primary=createPrimaryKey(id);
    public QUsageAccount(String variable) {
        super(UsageAccount.class,forVariable(variable),null,"ARG_USAGE_ACCOUNT");
        addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
    }
}
