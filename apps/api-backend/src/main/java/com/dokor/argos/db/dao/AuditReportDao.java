package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.QAuditReport;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.util.Optional;

@Singleton
public class AuditReportDao extends CrudDaoQuerydsl<AuditReport> {
    private static final QAuditReport REPORT = QAuditReport.auditReport;

    @Inject
    public AuditReportDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, REPORT);
    }

    public Optional<AuditReport> findByTokenHash(byte[] tokenHash) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(REPORT)
                .from(REPORT)
                .where(REPORT.tokenHash.eq(tokenHash))
                .fetchOne()
        );
    }

    public Optional<AuditReport> findByRunId(long runId) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(REPORT)
                .from(REPORT)
                .where(REPORT.runId.eq(runId))
                .fetchOne()
        );
    }

    public Optional<AuditReport> findByToken(String token) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(REPORT)
                .from(REPORT)
                .where(REPORT.publicToken.eq(token))
                .fetchOne()
        );
    }
}
