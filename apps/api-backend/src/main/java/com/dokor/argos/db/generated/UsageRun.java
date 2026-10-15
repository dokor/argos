package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
@Getter @Setter
public class UsageRun extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("user_id") private Long userId;
    @Column("period") private String period;
    @Column("state") private String state;
    @Column("created_at") private Instant createdAt;
    @Column("released_at") private Instant releasedAt;
    @Column("counted_at") private Instant countedAt;
    @Override public String toString() { return "UsageRun#"+id; }
}
