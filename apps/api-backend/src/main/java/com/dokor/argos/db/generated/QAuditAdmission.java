package com.dokor.argos.db.generated;

import com.querydsl.core.types.dsl.NumberPath;
import com.querydsl.sql.*;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import java.sql.Types;

/** QueryDSL mapping maintained with V17. */
public class QAuditAdmission extends RelationalPathBase<AuditAdmission> {
    public static final QAuditAdmission auditAdmission = new QAuditAdmission("ARG_AUDIT_ADMISSION");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final NumberPath<Integer> pending = createNumber("pending", Integer.class);
    public final PrimaryKey<AuditAdmission> primary = createPrimaryKey(id);
    public QAuditAdmission(String variable) {
        super(AuditAdmission.class, forVariable(variable), "null", "ARG_AUDIT_ADMISSION");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).notNull());
        addMetadata(pending, ColumnMetadata.named("pending").withIndex(2).ofType(Types.INTEGER).notNull());
    }
}
