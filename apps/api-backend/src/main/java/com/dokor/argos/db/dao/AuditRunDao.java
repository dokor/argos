package com.dokor.argos.db.dao;


import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.QAuditRun;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


@Singleton
public class AuditRunDao extends CrudDaoQuerydsl<AuditRun> {

    private static final Logger logger = LoggerFactory.getLogger(AuditRunDao.class);

    @Inject
    public AuditRunDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, QAuditRun.auditRun);
    }

}
