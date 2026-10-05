package com.dokor.argos.services.scheduler;

import com.coreoz.wisp.Scheduler;
import com.coreoz.wisp.schedule.Schedule;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.domain.audit.AuditService;
import com.dokor.argos.services.domain.audit.StuckAuditRunReaper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.time.Duration;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchedulerJobsTest {
    private final Scheduler scheduler = mock(Scheduler.class);
    private final ConfigurationService configuration = mock(ConfigurationService.class);
    private final AuditService audits = mock(AuditService.class);
    private final StuckAuditRunReaper reaper = mock(StuckAuditRunReaper.class);

    private Runnable job(String name) {
        when(configuration.auditSchedulerInterval()).thenReturn(Duration.ofSeconds(5));
        when(configuration.auditStuckCheckInterval()).thenReturn(Duration.ofMinutes(1));
        new SchedulerJobs(scheduler, configuration, audits, reaper).scheduleJobs();
        var task = ArgumentCaptor.forClass(Runnable.class);
        verify(scheduler).schedule(eq(name), task.capture(), any(Schedule.class));
        verify(scheduler, times(3)).schedule(anyString(), any(Runnable.class), any(Schedule.class));
        return task.getValue();
    }
    @Test void successfulAndEmptyQueueTicksCanRunAgain() {
        when(audits.processNextQueuedRun()).thenReturn(true, false, true);
        Runnable tick = job("Process queued audit runs");
        for (int i = 0; i < 3; i++) assertDoesNotThrow(tick::run);
        verify(audits, times(3)).processNextQueuedRun();
        verifyNoInteractions(reaper);
    }
    @Test void queueExceptionDoesNotPreventTheNextTick() {
        when(audits.processNextQueuedRun()).thenThrow(new IllegalStateException("synthetic failure")).thenReturn(true);
        Runnable tick = job("Process queued audit runs");
        assertDoesNotThrow(tick::run);
        assertDoesNotThrow(tick::run);
        verify(audits, times(2)).processNextQueuedRun();
    }
    @Test void reaperSuccessAndEmptyResultRemainSchedulable() {
        when(reaper.reapStuckRuns()).thenReturn(2, 0);
        Runnable tick = job("Reap stuck audit runs");
        assertDoesNotThrow(tick::run);
        assertDoesNotThrow(tick::run);
        verify(reaper, times(2)).reapStuckRuns();
        verifyNoInteractions(audits);
    }
    @Test void reaperExceptionDoesNotPreventTheNextTick() {
        when(reaper.reapStuckRuns()).thenThrow(new IllegalStateException("synthetic failure")).thenReturn(1);
        Runnable tick = job("Reap stuck audit runs");
        assertDoesNotThrow(tick::run);
        assertDoesNotThrow(tick::run);
        verify(reaper, times(2)).reapStuckRuns();
    }
}
