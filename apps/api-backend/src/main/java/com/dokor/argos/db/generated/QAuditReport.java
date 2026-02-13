package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;

import com.querydsl.sql.ColumnMetadata;
import java.sql.Types;




/**
 * QAuditReport is a Querydsl query type for AuditReport
 */
@Generated("com.querydsl.sql.codegen.MetaDataSerializer")
public class QAuditReport extends com.querydsl.sql.RelationalPathBase<AuditReport> {

    private static final long serialVersionUID = -47662420;

    public static final QAuditReport auditReport = new QAuditReport("ARG_AUDIT_REPORT");

    public final NumberPath<Long> auditId = createNumber("auditId", Long.class);

    public final DateTimePath<java.time.Instant> createdAt = createDateTime("createdAt", java.time.Instant.class);

    public final StringPath domain = createString("domain");

    public final DateTimePath<java.time.Instant> expiresAt = createDateTime("expiresAt", java.time.Instant.class);

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath logoUrl = createString("logoUrl");

    public final StringPath publicToken = createString("publicToken");

    public final StringPath reportJson = createString("reportJson");

    public final NumberPath<Long> runId = createNumber("runId", Long.class);

    public final StringPath siteTitle = createString("siteTitle");

    public final StringPath targetUrl = createString("targetUrl");

    public final SimplePath<byte[]> tokenHash = createSimple("tokenHash", byte[].class);

    public final com.querydsl.sql.PrimaryKey<AuditReport> primary = createPrimaryKey(id);

    public final com.querydsl.sql.ForeignKey<Audit> reportAuditFk = createForeignKey(auditId, "id");

    public final com.querydsl.sql.ForeignKey<AuditRun> reportRunFk = createForeignKey(runId, "id");

    public QAuditReport(String variable) {
        super(AuditReport.class, forVariable(variable), "null", "ARG_AUDIT_REPORT");
        addMetadata();
    }

    public QAuditReport(String variable, String schema, String table) {
        super(AuditReport.class, forVariable(variable), schema, table);
        addMetadata();
    }

    public QAuditReport(String variable, String schema) {
        super(AuditReport.class, forVariable(variable), schema, "ARG_AUDIT_REPORT");
        addMetadata();
    }

    public QAuditReport(Path<? extends AuditReport> path) {
        super(path.getType(), path.getMetadata(), "null", "ARG_AUDIT_REPORT");
        addMetadata();
    }

    public QAuditReport(PathMetadata metadata) {
        super(AuditReport.class, metadata, "null", "ARG_AUDIT_REPORT");
        addMetadata();
    }

    public void addMetadata() {
        addMetadata(auditId, ColumnMetadata.named("audit_id").withIndex(3).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(10).ofType(Types.TIMESTAMP).withSize(23).notNull());
        addMetadata(domain, ColumnMetadata.named("domain").withIndex(5).ofType(Types.VARCHAR).withSize(255).notNull());
        addMetadata(expiresAt, ColumnMetadata.named("expires_at").withIndex(11).ofType(Types.TIMESTAMP).withSize(23));
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(logoUrl, ColumnMetadata.named("logo_url").withIndex(8).ofType(Types.LONGVARCHAR).withSize(65535));
        addMetadata(publicToken, ColumnMetadata.named("public_token").withIndex(12).ofType(Types.VARCHAR).withSize(64).notNull());
        addMetadata(reportJson, ColumnMetadata.named("report_json").withIndex(9).ofType(Types.LONGVARCHAR).withSize(2147483647).notNull());
        addMetadata(runId, ColumnMetadata.named("run_id").withIndex(4).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(siteTitle, ColumnMetadata.named("site_title").withIndex(7).ofType(Types.VARCHAR).withSize(512));
        addMetadata(targetUrl, ColumnMetadata.named("target_url").withIndex(6).ofType(Types.LONGVARCHAR).withSize(65535).notNull());
        addMetadata(tokenHash, ColumnMetadata.named("token_hash").withIndex(2).ofType(Types.BINARY).withSize(32).notNull());
    }

}

