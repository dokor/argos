package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
public class QFeedbackEvent extends RelationalPathBase<FeedbackEvent> {
 public static final QFeedbackEvent table=new QFeedbackEvent("ARG_FEEDBACK_EVENT");
 public final NumberPath<Long> id=createNumber("id",Long.class),feedbackId=createNumber("feedbackId",Long.class),actorId=createNumber("actorId",Long.class);
 public final StringPath oldStatus=createString("oldStatus"),newStatus=createString("newStatus");
 public final DateTimePath<Instant> createdAt=createDateTime("createdAt",Instant.class);
 public final PrimaryKey<FeedbackEvent> primary=createPrimaryKey(id);
 public QFeedbackEvent(String variable) {
  super(FeedbackEvent.class,forVariable(variable),null,"ARG_FEEDBACK_EVENT");
  addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
  addMetadata(feedbackId,ColumnMetadata.named("feedback_id").ofType(Types.BIGINT));
  addMetadata(actorId,ColumnMetadata.named("actor_id").ofType(Types.BIGINT));
  addMetadata(oldStatus,ColumnMetadata.named("old_status").ofType(Types.VARCHAR));
  addMetadata(newStatus,ColumnMetadata.named("new_status").ofType(Types.VARCHAR));
  addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
 }
}
