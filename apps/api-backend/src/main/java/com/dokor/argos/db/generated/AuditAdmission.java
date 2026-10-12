package com.dokor.argos.db.generated;

import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import lombok.Getter;
import lombok.Setter;

/** Mapping maintained with V17. Infrastructure state must never be exposed in API DTOs. */
@Getter @Setter
public class AuditAdmission extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("pending") private Integer pending;
}
