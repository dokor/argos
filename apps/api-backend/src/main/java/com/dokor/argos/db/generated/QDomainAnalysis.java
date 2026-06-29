package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;
import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;
import com.querydsl.sql.ColumnMetadata;
import java.sql.Types;

/**
 * QDomainAnalysis is a Querydsl query type for DomainAnalysis
 */
@Generated("com.querydsl.sql.codegen.MetaDataSerializer")
public class QDomainAnalysis extends com.querydsl.sql.RelationalPathBase<DomainAnalysis> {

    private static final long serialVersionUID = 1L;

    public static final QDomainAnalysis domainAnalysis = new QDomainAnalysis("ARG_DOMAIN_ANALYSIS");

    public final DateTimePath<java.time.Instant> analyzedAt = createDateTime("analyzedAt", java.time.Instant.class);

    public final NumberPath<Long> domainId = createNumber("domainId", Long.class);

    public final DateTimePath<java.time.Instant> expiresAt = createDateTime("expiresAt", java.time.Instant.class);

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath resultJson = createString("resultJson");

    public final com.querydsl.sql.PrimaryKey<DomainAnalysis> primary = createPrimaryKey(id);

    public final com.querydsl.sql.ForeignKey<Domain> domainAnalysisDomainFk = createForeignKey(domainId, "id");

    public QDomainAnalysis(String variable) {
        super(DomainAnalysis.class, forVariable(variable), "null", "ARG_DOMAIN_ANALYSIS");
        addMetadata();
    }

    public QDomainAnalysis(String variable, String schema, String table) {
        super(DomainAnalysis.class, forVariable(variable), schema, table);
        addMetadata();
    }

    public QDomainAnalysis(String variable, String schema) {
        super(DomainAnalysis.class, forVariable(variable), schema, "ARG_DOMAIN_ANALYSIS");
        addMetadata();
    }

    public QDomainAnalysis(Path<? extends DomainAnalysis> path) {
        super(path.getType(), path.getMetadata(), "null", "ARG_DOMAIN_ANALYSIS");
        addMetadata();
    }

    public QDomainAnalysis(PathMetadata metadata) {
        super(DomainAnalysis.class, metadata, "null", "ARG_DOMAIN_ANALYSIS");
        addMetadata();
    }

    public void addMetadata() {
        addMetadata(analyzedAt,  ColumnMetadata.named("analyzed_at").withIndex(3).ofType(Types.TIMESTAMP).withSize(23).notNull());
        addMetadata(domainId,    ColumnMetadata.named("domain_id").withIndex(2).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(expiresAt,   ColumnMetadata.named("expires_at").withIndex(5).ofType(Types.TIMESTAMP).withSize(23).notNull());
        addMetadata(id,          ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(resultJson,  ColumnMetadata.named("result_json").withIndex(4).ofType(Types.LONGVARCHAR).withSize(2147483647).notNull());
    }
}
