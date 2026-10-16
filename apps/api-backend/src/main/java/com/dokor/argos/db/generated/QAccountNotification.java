package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
public class QAccountNotification extends RelationalPathBase<AccountNotification> {
 public static final QAccountNotification table=new QAccountNotification("ARG_ACCOUNT_NOTIFICATION");
 public final NumberPath<Long> id=createNumber("id",Long.class),ownerUserId=createNumber("ownerUserId",Long.class),entityId=createNumber("entityId",Long.class),siteId=createNumber("siteId",Long.class);
 public final NumberPath<Integer> itemCount=createNumber("itemCount",Integer.class);
 public final StringPath eventKey=createString("eventKey"),type=createString("type"),hostname=createString("hostname");
 public final DateTimePath<Instant> createdAt=createDateTime("createdAt",Instant.class),readAt=createDateTime("readAt",Instant.class);
 public final PrimaryKey<AccountNotification> primary=createPrimaryKey(id);
 public QAccountNotification(String variable){super(AccountNotification.class,forVariable(variable),null,"ARG_ACCOUNT_NOTIFICATION");
  addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));addMetadata(ownerUserId,ColumnMetadata.named("owner_user_id").ofType(Types.BIGINT));
  addMetadata(entityId,ColumnMetadata.named("entity_id").ofType(Types.BIGINT));addMetadata(siteId,ColumnMetadata.named("site_id").ofType(Types.BIGINT));
  addMetadata(itemCount,ColumnMetadata.named("item_count").ofType(Types.INTEGER));addMetadata(eventKey,ColumnMetadata.named("event_key").ofType(Types.VARCHAR));
  addMetadata(type,ColumnMetadata.named("type").ofType(Types.VARCHAR));addMetadata(hostname,ColumnMetadata.named("hostname").ofType(Types.VARCHAR));
  addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));addMetadata(readAt,ColumnMetadata.named("read_at").ofType(Types.TIMESTAMP));
 }
}
