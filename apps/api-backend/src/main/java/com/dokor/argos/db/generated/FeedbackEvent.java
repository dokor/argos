package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
@Getter @Setter
public class FeedbackEvent extends CrudEntityQuerydsl {
 @Column("id") private Long id;
 @Column("feedback_id") private Long feedbackId;
 @Column("actor_id") private Long actorId;
 @Column("old_status") private String oldStatus;
 @Column("new_status") private String newStatus;
 @Column("created_at") private java.time.Instant createdAt;
 @Override public String toString() {return "FeedbackEvent#"+id;}
}
