package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;

import com.querydsl.sql.ColumnMetadata;
import java.sql.Types;




/**
 * QAuditRun is a Querydsl query type for AuditRun
 */
@Generated("com.querydsl.sql.codegen.MetaDataSerializer")
public class QAuditRun extends com.querydsl.sql.RelationalPathBase<AuditRun> {

    private static final long serialVersionUID = -2094790637;

    public static final QAuditRun auditRun = new QAuditRun("ARG_AUDIT_RUN");

    public final NumberPath<Long> auditId = createNumber("auditId", Long.class);

    public final StringPath claimToken = createString("claimToken");

    public final DateTimePath<java.time.Instant> createdAt = createDateTime("createdAt", java.time.Instant.class);

    public final DateTimePath<java.time.Instant> finishedAt = createDateTime("finishedAt", java.time.Instant.class);

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath lastError = createString("lastError");

    public final StringPath resultJson = createString("resultJson");

    public final DateTimePath<java.time.Instant> startedAt = createDateTime("startedAt", java.time.Instant.class);

    public final StringPath status = createString("status");

    public final com.querydsl.sql.PrimaryKey<AuditRun> primary = createPrimaryKey(id);

    public final com.querydsl.sql.ForeignKey<Audit> runAuditFk = createForeignKey(auditId, "id");

    public final com.querydsl.sql.ForeignKey<AuditReport> _reportRunFk = createInvForeignKey(id, "run_id");

    public QAuditRun(String variable) {
        super(AuditRun.class, forVariable(variable), "null", "ARG_AUDIT_RUN");
        addMetadata();
    }

    public QAuditRun(String variable, String schema, String table) {
        super(AuditRun.class, forVariable(variable), schema, table);
        addMetadata();
    }

    public QAuditRun(String variable, String schema) {
        super(AuditRun.class, forVariable(variable), schema, "ARG_AUDIT_RUN");
        addMetadata();
    }

    public QAuditRun(Path<? extends AuditRun> path) {
        super(path.getType(), path.getMetadata(), "null", "ARG_AUDIT_RUN");
        addMetadata();
    }

    public QAuditRun(PathMetadata metadata) {
        super(AuditRun.class, metadata, "null", "ARG_AUDIT_RUN");
        addMetadata();
    }

    public void addMetadata() {
        addMetadata(auditId, ColumnMetadata.named("audit_id").withIndex(2).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(claimToken, ColumnMetadata.named("claim_token").withIndex(9).ofType(Types.VARCHAR).withSize(64));
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(4).ofType(Types.TIMESTAMP).withSize(23).notNull());
        addMetadata(finishedAt, ColumnMetadata.named("finished_at").withIndex(6).ofType(Types.TIMESTAMP).withSize(23));
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(lastError, ColumnMetadata.named("last_error").withIndex(7).ofType(Types.LONGVARCHAR).withSize(65535));
        addMetadata(resultJson, ColumnMetadata.named("result_json").withIndex(8).ofType(Types.LONGVARCHAR).withSize(2147483647));
        addMetadata(startedAt, ColumnMetadata.named("started_at").withIndex(5).ofType(Types.TIMESTAMP).withSize(23));
        addMetadata(status, ColumnMetadata.named("status").withIndex(3).ofType(Types.VARCHAR).withSize(16).notNull());
    }

}

