package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.ColumnMetadata;
import java.sql.Types;
import javax.annotation.processing.Generated;

@Generated("com.querydsl.sql.codegen.MetaDataSerializer")
public class QReportProblemCheck extends com.querydsl.sql.RelationalPathBase<ReportProblemCheck> {
    public static final QReportProblemCheck reportProblemCheck=new QReportProblemCheck("ARG_REPORT_PROBLEM_CHECK");
    public final NumberPath<Long> reportId=createNumber("reportId",Long.class);
    public final StringPath checkKey=createString("checkKey");
    public final StringPath category=createString("category");
    public final StringPath severity=createString("severity");
    public final com.querydsl.sql.PrimaryKey<ReportProblemCheck> primary=createPrimaryKey(reportId,checkKey);
    public final com.querydsl.sql.ForeignKey<AuditReport> reportFk=createForeignKey(reportId,"id");
    public QReportProblemCheck(String variable) {
        super(ReportProblemCheck.class,forVariable(variable),"null","ARG_REPORT_PROBLEM_CHECK");
        addMetadata(reportId,ColumnMetadata.named("report_id").ofType(Types.BIGINT).notNull());
        addMetadata(checkKey,ColumnMetadata.named("check_key").ofType(Types.VARCHAR).withSize(200).notNull());
        addMetadata(category,ColumnMetadata.named("category").ofType(Types.VARCHAR).withSize(16).notNull());
        addMetadata(severity,ColumnMetadata.named("severity").ofType(Types.VARCHAR).withSize(16));
    }
}
