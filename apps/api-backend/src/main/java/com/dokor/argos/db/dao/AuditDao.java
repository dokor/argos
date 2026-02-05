package com.dokor.argos.db.dao;


import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.QAudit;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


@Singleton
public class AuditDao extends CrudDaoQuerydsl<Audit> {

    private static final Logger logger = LoggerFactory.getLogger(AuditDao.class);

    @Inject
    public AuditDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, QAudit.audit);
    }

}
