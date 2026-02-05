package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;

import com.querydsl.sql.ColumnMetadata;
import java.sql.Types;




/**
 * QAudit is a Querydsl query type for Audit
 */
@Generated("com.querydsl.sql.codegen.MetaDataSerializer")
public class QAudit extends com.querydsl.sql.RelationalPathBase<Audit> {

    private static final long serialVersionUID = 1401117528;

    public static final QAudit audit = new QAudit("ARG_AUDIT");

    public final DateTimePath<java.time.Instant> createdAt = createDateTime("createdAt", java.time.Instant.class);

    public final StringPath hostname = createString("hostname");

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath inputUrl = createString("inputUrl");

    public final StringPath normalizedUrl = createString("normalizedUrl");

    public final com.querydsl.sql.PrimaryKey<Audit> primary = createPrimaryKey(id);

    public final com.querydsl.sql.ForeignKey<AuditRun> _runAuditFk = createInvForeignKey(id, "audit_id");

    public QAudit(String variable) {
        super(Audit.class, forVariable(variable), "null", "ARG_AUDIT");
        addMetadata();
    }

    public QAudit(String variable, String schema, String table) {
        super(Audit.class, forVariable(variable), schema, table);
        addMetadata();
    }

    public QAudit(String variable, String schema) {
        super(Audit.class, forVariable(variable), schema, "ARG_AUDIT");
        addMetadata();
    }

    public QAudit(Path<? extends Audit> path) {
        super(path.getType(), path.getMetadata(), "null", "ARG_AUDIT");
        addMetadata();
    }

    public QAudit(PathMetadata metadata) {
        super(Audit.class, metadata, "null", "ARG_AUDIT");
        addMetadata();
    }

    public void addMetadata() {
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(5).ofType(Types.TIMESTAMP).withSize(23).notNull());
        addMetadata(hostname, ColumnMetadata.named("hostname").withIndex(4).ofType(Types.VARCHAR).withSize(255).notNull());
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(inputUrl, ColumnMetadata.named("input_url").withIndex(2).ofType(Types.LONGVARCHAR).withSize(65535).notNull());
        addMetadata(normalizedUrl, ColumnMetadata.named("normalized_url").withIndex(3).ofType(Types.LONGVARCHAR).withSize(65535).notNull());
    }

}

