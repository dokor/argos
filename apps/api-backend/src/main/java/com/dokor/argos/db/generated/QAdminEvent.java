package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
public class QAdminEvent extends RelationalPathBase<AdminEvent> {
 public static final QAdminEvent table=new QAdminEvent("ARG_ADMIN_EVENT");
 public final NumberPath<Long> id=createNumber("id",Long.class), actorId=createNumber("actorId",Long.class),
 targetId=createNumber("targetId",Long.class), oldLimit=createNumber("oldLimit",Long.class), newLimit=createNumber("newLimit",Long.class);
 public final StringPath oldOffer=createString("oldOffer"),newOffer=createString("newOffer");
 public final DateTimePath<Instant> createdAt=createDateTime("createdAt",Instant.class);
 public final PrimaryKey<AdminEvent> primary=createPrimaryKey(id);
 public QAdminEvent(String variable) {
  super(AdminEvent.class,forVariable(variable),null,"ARG_ADMIN_EVENT");
  addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
  addMetadata(actorId,ColumnMetadata.named("actor_id").ofType(Types.BIGINT));
  addMetadata(targetId,ColumnMetadata.named("target_id").ofType(Types.BIGINT));
  addMetadata(oldLimit,ColumnMetadata.named("old_limit").ofType(Types.BIGINT));
  addMetadata(newLimit,ColumnMetadata.named("new_limit").ofType(Types.BIGINT));
  addMetadata(oldOffer,ColumnMetadata.named("old_offer").ofType(Types.VARCHAR));
  addMetadata(newOffer,ColumnMetadata.named("new_offer").ofType(Types.VARCHAR));
  addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
 }
}
