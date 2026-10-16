package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.QAuditRun;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.QBean;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.Connection;
import java.util.List;
import java.util.Optional;

/** Personal run reads never load result blobs, errors, worker claims or report credentials. */
@Singleton
public class AccountRunReadDao {
    private static final QAuditRun RUN = QAuditRun.auditRun;
    private static final QBean<AuditRun> STATUS = Projections.bean(AuditRun.class,
        RUN.id, RUN.auditId, RUN.status, RUN.createdAt, RUN.moduleStatuses,
        RUN.startedAt, RUN.finishedAt, RUN.profileSnapshot);
    private final TransactionManagerQuerydsl transactions;

    @Inject
    public AccountRunReadDao(TransactionManagerQuerydsl transactions) {
        this.transactions = transactions;
    }

    public List<AuditRun> list(long owner, int limit, Connection connection) {
        return transactions.selectQuery(connection).select(STATUS).from(RUN)
            .where(RUN.ownerUserId.eq(owner))
            .orderBy(RUN.createdAt.desc(), RUN.id.desc())
            .limit(Math.max(1, Math.min(limit, 100))).fetch();
    }

    public Optional<AuditRun> owned(long id, long owner, Connection connection) {
        return Optional.ofNullable(transactions.selectQuery(connection).select(STATUS).from(RUN)
            .where(RUN.id.eq(id), RUN.ownerUserId.eq(owner)).fetchOne());
    }
}
