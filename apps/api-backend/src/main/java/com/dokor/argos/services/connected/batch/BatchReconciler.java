package com.dokor.argos.services.connected.batch;

import com.dokor.argos.db.dao.BatchDao;

import jakarta.inject.*;

import org.slf4j.LoggerFactory;

@Singleton
public final class BatchReconciler {
    private final BatchDao dao;
    private final BatchService service;

    @Inject
    public BatchReconciler(BatchDao dao, BatchService service) {
        this.dao = dao;
        this.service = service;
    }

    public void tick() {
        for (long id : dao.activeIds())
            try {
                service.reconcile(id);
            } catch (RuntimeException e) {
                LoggerFactory.getLogger(BatchReconciler.class)
                        .warn(
                                "Batch reconciliation deferred id={} type={}",
                                id,
                                e.getClass().getSimpleName());
            }
    }
}
