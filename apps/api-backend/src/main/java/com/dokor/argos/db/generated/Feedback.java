package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Getter @Setter
public class Feedback extends CrudEntityQuerydsl {
 @Column("id") private Long id;
 @Column("type") private String type;
 @Column("status") private String status;
 @Column("description") private String description;
 @Column("urls") private String urls;
 @Column("page") private String page;
 @Column("expected") private String expected;
 @Column("observed") private String observed;
 @Column("steps") private String steps;
 @Column("run_id") private Long runId;
 @Column("finding_key") private String findingKey;
 @Column("created_at") private Instant createdAt;
 @Column("updated_at") private Instant updatedAt;
 @Override public String toString() {return "Feedback#"+id;}
}
