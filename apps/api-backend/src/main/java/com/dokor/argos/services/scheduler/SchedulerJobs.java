package com.dokor.argos.services.scheduler;

import com.coreoz.wisp.LongRunningJobMonitor;
import com.coreoz.wisp.Scheduler;
import com.coreoz.wisp.schedule.Schedules;
import com.dokor.argos.services.configuration.ConfigurationService;

import com.dokor.argos.services.domain.audit.AuditService;
import com.dokor.argos.services.domain.audit.StuckAuditRunReaper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

@Singleton
public class SchedulerJobs {

    private static final Logger logger = LoggerFactory.getLogger(SchedulerJobs.class);

    private final Scheduler scheduler;
    private final ConfigurationService configurationService;
    private final AuditService auditService;
    private final StuckAuditRunReaper stuckAuditRunReaper;

    @Inject
    public SchedulerJobs(
        Scheduler scheduler,
        ConfigurationService configurationService,
        AuditService auditService,
        StuckAuditRunReaper stuckAuditRunReaper
    ) {
        this.scheduler = scheduler;
        this.configurationService = configurationService;
        this.auditService = auditService;
        this.stuckAuditRunReaper = stuckAuditRunReaper;
    }

    public void scheduleJobs() {

        scheduler.schedule(
            "Process queued audit runs",
            this::processAuditQueue,
            Schedules.fixedDelaySchedule(configurationService.auditSchedulerInterval())
        );

        scheduler.schedule(
            "Long running job monitor",
            new LongRunningJobMonitor(scheduler),
            Schedules.fixedDelaySchedule(Duration.ofMinutes(1))
        );

        scheduler.schedule(
            "Reap stuck audit runs",
            this::reapStuckAuditRuns,
            Schedules.fixedDelaySchedule(configurationService.auditStuckCheckInterval())
        );
    }

    private void processAuditQueue() {
        try {
            boolean processed = auditService.processNextQueuedRun();
            if (!processed) {
                logger.debug("No queued audit run found");
            }
        } catch (Exception e) {
            logger.error("Error while processing audit queue", e);
        }
    }

    private void reapStuckAuditRuns() {
        try {
            int handled = stuckAuditRunReaper.reapStuckRuns();
            if (handled > 0) {
                logger.info("Stuck audit run reaper handled {} run(s)", handled);
            }
        } catch (Exception e) {
            logger.error("Error while reaping stuck audit runs", e);
        }
    }
}
