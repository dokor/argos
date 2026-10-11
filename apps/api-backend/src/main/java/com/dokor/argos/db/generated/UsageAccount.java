package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;
@Getter @Setter
public class UsageAccount extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Override public String toString() { return "UsageAccount#"+id; }
}
