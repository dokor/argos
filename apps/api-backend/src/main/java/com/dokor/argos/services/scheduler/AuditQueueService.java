package com.dokor.argos.services.scheduler;

import com.dokor.argos.services.analysis.AuditProcessorService;
import com.dokor.argos.services.domain.audit.AuditRunService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Claims one queued run and invokes the processor; scheduled timing stays in SchedulerJobs. */
@Singleton
public class AuditQueueService {
    private static final Logger logger = LoggerFactory.getLogger(AuditQueueService.class);
    private final AuditRunService runs;
    private final AuditProcessorService processor;

    @Inject
    public AuditQueueService(AuditRunService runs, AuditProcessorService processor) {
        this.runs = runs;
        this.processor = processor;
    }

    public boolean processNextQueuedRun() {
        return runs.claimNextQueuedRun().map(run -> {
            logger.info("Processing queued runId={}", run.getId());
            processor.process(run.getId());
            return true;
        }).orElse(false);
    }
}
