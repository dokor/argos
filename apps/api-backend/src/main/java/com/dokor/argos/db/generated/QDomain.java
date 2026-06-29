package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;
import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;
import com.querydsl.sql.ColumnMetadata;
import java.sql.Types;

/**
 * QDomain is a Querydsl query type for Domain
 */
@Generated("com.querydsl.sql.codegen.MetaDataSerializer")
public class QDomain extends com.querydsl.sql.RelationalPathBase<Domain> {

    private static final long serialVersionUID = 1L;

    public static final QDomain domain = new QDomain("ARG_DOMAIN");

    public final DateTimePath<java.time.Instant> createdAt = createDateTime("createdAt", java.time.Instant.class);

    public final StringPath hostname = createString("hostname");

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final com.querydsl.sql.PrimaryKey<Domain> primary = createPrimaryKey(id);

    public final com.querydsl.sql.ForeignKey<Audit> _auditDomainFk = createInvForeignKey(id, "domain_id");

    public final com.querydsl.sql.ForeignKey<DomainAnalysis> _domainAnalysisDomainFk = createInvForeignKey(id, "domain_id");

    public QDomain(String variable) {
        super(Domain.class, forVariable(variable), "null", "ARG_DOMAIN");
        addMetadata();
    }

    public QDomain(String variable, String schema, String table) {
        super(Domain.class, forVariable(variable), schema, table);
        addMetadata();
    }

    public QDomain(String variable, String schema) {
        super(Domain.class, forVariable(variable), schema, "ARG_DOMAIN");
        addMetadata();
    }

    public QDomain(Path<? extends Domain> path) {
        super(path.getType(), path.getMetadata(), "null", "ARG_DOMAIN");
        addMetadata();
    }

    public QDomain(PathMetadata metadata) {
        super(Domain.class, metadata, "null", "ARG_DOMAIN");
        addMetadata();
    }

    public void addMetadata() {
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(3).ofType(Types.TIMESTAMP).withSize(23).notNull());
        addMetadata(hostname,  ColumnMetadata.named("hostname").withIndex(2).ofType(Types.VARCHAR).withSize(255).notNull());
        addMetadata(id,        ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).withSize(19).notNull());
    }
}
