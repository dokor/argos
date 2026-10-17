package com.dokor.argos.services.scheduler;

import com.coreoz.wisp.LongRunningJobMonitor;
import com.coreoz.wisp.Scheduler;
import com.coreoz.wisp.schedule.Schedules;
import com.dokor.argos.services.configuration.ConfigurationService;

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
    private final com.dokor.argos.services.domain.report.ReportRetentionService retention;
    private final com.dokor.argos.services.analytics.ProductAnalyticsService analytics;
    private final ConfigurationService configurationService;
    private final AuditQueueService auditQueueService;
    private final StuckAuditRunReaper stuckAuditRunReaper;
    private final com.dokor.argos.services.feedback.FeedbackService feedback;

    public SchedulerJobs(Scheduler scheduler,ConfigurationService configuration,AuditQueueService queue,StuckAuditRunReaper reaper){this(scheduler,configuration,queue,reaper,null);}
    public SchedulerJobs(Scheduler scheduler,ConfigurationService configuration,AuditQueueService queue,StuckAuditRunReaper reaper,com.dokor.argos.services.analytics.ProductAnalyticsService analytics){this(scheduler,configuration,queue,reaper,analytics,null);}
    public SchedulerJobs(Scheduler scheduler,ConfigurationService configuration,AuditQueueService queue,StuckAuditRunReaper reaper,com.dokor.argos.services.analytics.ProductAnalyticsService analytics,com.dokor.argos.services.domain.report.ReportRetentionService retention) {this(scheduler,configuration,queue,reaper,analytics,retention,null);}
    private com.dokor.argos.services.connected.batch.BatchReconciler batches;
    private com.dokor.argos.services.notifications.NotificationService notifications;
    private com.dokor.argos.services.domain.premium.PremiumWaitlistService premiumWaitlist;
    private com.dokor.argos.services.statistics.ProblemStatisticsService problemStatistics;
    @Inject public void problemStatistics(com.dokor.argos.services.statistics.ProblemStatisticsService service){this.problemStatistics=service;}
    @Inject public void premiumWaitlist(com.dokor.argos.services.domain.premium.PremiumWaitlistService service){this.premiumWaitlist=service;}
    @Inject public void notifications(com.dokor.argos.services.notifications.NotificationService service){this.notifications=service;}
    @Inject public void batches(com.dokor.argos.services.connected.batch.BatchReconciler reconciler){this.batches=reconciler;}
    private com.dokor.argos.services.connected.discovery.DiscoveryWorker discoveries;
    @Inject public void discoveries(com.dokor.argos.services.connected.discovery.DiscoveryWorker worker){this.discoveries=worker;}

    @Inject
    public SchedulerJobs(
        Scheduler scheduler,
        ConfigurationService configurationService,
        AuditQueueService auditQueueService,
        StuckAuditRunReaper stuckAuditRunReaper, com.dokor.argos.services.analytics.ProductAnalyticsService analytics,
        com.dokor.argos.services.domain.report.ReportRetentionService retention,
        com.dokor.argos.services.feedback.FeedbackService feedback
    ) {
        this.scheduler = scheduler;
        this.feedback = feedback;
        this.retention = retention;
        this.analytics = analytics;
        this.configurationService = configurationService;
        this.auditQueueService = auditQueueService;
        this.stuckAuditRunReaper = stuckAuditRunReaper;
    }

    public void scheduleJobs() {
        if(problemStatistics!=null) scheduler.schedule("Project problem statistics",problemStatistics::backfill,Schedules.fixedDelaySchedule(Duration.ofMinutes(1)));
        if(premiumWaitlist!=null) scheduler.schedule("Purge expired premium interest",premiumWaitlist::purge,Schedules.fixedDelaySchedule(Duration.ofHours(1)));
        if(notifications!=null) scheduler.schedule("Purge account notifications",notifications::purge,Schedules.fixedDelaySchedule(Duration.ofHours(1)));
        if(batches!=null) scheduler.schedule("Reconcile domain batches",batches::tick,Schedules.fixedDelaySchedule(Duration.ofSeconds(2)));
        if(discoveries!=null) scheduler.schedule("Discover domain pages", discoveries::tick, Schedules.fixedDelaySchedule(Duration.ofSeconds(2)));
        if(feedback!=null) scheduler.schedule("Purge private feedback", feedback::purge, Schedules.fixedDelaySchedule(Duration.ofHours(1)));
        if(retention!=null) scheduler.schedule("Purge expired reports", retention::purgeExpiredReports, Schedules.fixedDelaySchedule(Duration.ofHours(1)));
        if(analytics!=null) scheduler.schedule("Purge product telemetry", analytics::purgeTelemetry, Schedules.fixedDelaySchedule(Duration.ofHours(1)));

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
            boolean processed = auditQueueService.processNextQueuedRun();
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
