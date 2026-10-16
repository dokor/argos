package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;

public class QFeedback extends RelationalPathBase<Feedback> {
 public static final QFeedback table=new QFeedback("ARG_FEEDBACK");
 public final NumberPath<Long> id=createNumber("id",Long.class),runId=createNumber("runId",Long.class);
 public final StringPath type=createString("type"),status=createString("status"),description=createString("description"),
 urls=createString("urls"),page=createString("page"),expected=createString("expected"),observed=createString("observed"),steps=createString("steps"),findingKey=createString("findingKey");
 public final DateTimePath<Instant> createdAt=createDateTime("createdAt",Instant.class),updatedAt=createDateTime("updatedAt",Instant.class);
 public final PrimaryKey<Feedback> primary=createPrimaryKey(id);
 public QFeedback(String variable) {
  super(Feedback.class,forVariable(variable),null,"ARG_FEEDBACK");
  addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
  addMetadata(runId,ColumnMetadata.named("run_id").ofType(Types.BIGINT));
  addMetadata(type,ColumnMetadata.named("type").ofType(Types.VARCHAR));
  addMetadata(status,ColumnMetadata.named("status").ofType(Types.VARCHAR));
  addMetadata(description,ColumnMetadata.named("description").ofType(Types.VARCHAR));
  addMetadata(urls,ColumnMetadata.named("urls").ofType(Types.VARCHAR));
  addMetadata(page,ColumnMetadata.named("page").ofType(Types.VARCHAR));
  addMetadata(expected,ColumnMetadata.named("expected").ofType(Types.VARCHAR));
  addMetadata(observed,ColumnMetadata.named("observed").ofType(Types.VARCHAR));
  addMetadata(steps,ColumnMetadata.named("steps").ofType(Types.VARCHAR));
  addMetadata(findingKey,ColumnMetadata.named("finding_key").ofType(Types.VARCHAR));
  addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
  addMetadata(updatedAt,ColumnMetadata.named("updated_at").ofType(Types.TIMESTAMP));
 }
}
