package com.dokor.argos.logging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.coreoz.wisp.Scheduler;
import com.coreoz.wisp.schedule.Schedule;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.audit.StuckAuditRunReaper;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.dokor.argos.services.scheduler.AuditQueueService;
import com.dokor.argos.services.scheduler.SchedulerJobs;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditLoggingTest {
    private static final String SECRET = "private-url-token-password";
    private static final String URL = "https://example.com/reset/" + SECRET + "?token=" + SECRET + "#" + SECRET;

    @Test void malformedReportLogsIdentityAndOriginWithoutJacksonMessageOrStack() throws Exception {
        var entity = new AuditReport();
        entity.setId(7L); entity.setRunId(42L); entity.setCreatedAt(Instant.now()); entity.setTargetUrl(URL);
        // Unknown property names are included in Jackson exception messages even with source snippets disabled.
        entity.setReportJson("{\"" + SECRET + "\":\"" + URL + "\"}");
        var mapper = new ObjectMapper();
        assertTrue(assertThrows(Exception.class, () -> mapper.readValue(entity.getReportJson(),
            com.dokor.argos.services.domain.report.ReportDto.class)).getMessage().contains(SECRET));
        var dao = mock(AuditReportDao.class);
        when(dao.findByRunId(42)).thenReturn(Optional.of(entity));
        try (var logs = new Capture(ReportReadService.class)) {
            assertTrue(new ReportReadService(dao, new TokenService(), mapper).getByRunId(42).isEmpty());
            logs.assertSafe();
            assertTrue(logs.events.list.getFirst().getFormattedMessage().contains("reportId=7 runId=42 origin=https://example.com"));
        }
    }

    @Test void schedulerFailuresNeverLogMessagesCausesOrSuppressedExceptions() {
        var scheduler = mock(Scheduler.class);
        var config = mock(ConfigurationService.class);
        when(config.auditSchedulerInterval()).thenReturn(Duration.ofSeconds(5));
        when(config.auditStuckCheckInterval()).thenReturn(Duration.ofMinutes(1));
        var queue = mock(AuditQueueService.class);
        var reaper = mock(StuckAuditRunReaper.class);
        var failure = new IllegalStateException(URL, new RuntimeException(SECRET));
        failure.addSuppressed(new RuntimeException(SECRET));
        when(queue.processNextQueuedRun()).thenThrow(failure);
        when(reaper.reapStuckRuns()).thenThrow(failure);
        new SchedulerJobs(scheduler, config, queue, reaper).scheduleJobs();
        var task = ArgumentCaptor.forClass(Runnable.class);
        try (var logs = new Capture(SchedulerJobs.class)) {
            verify(scheduler).schedule(eq("Process queued audit runs"), task.capture(), any(Schedule.class));
            assertDoesNotThrow(task.getValue()::run);
            verify(scheduler).schedule(eq("Reap stuck audit runs"), task.capture(), any(Schedule.class));
            assertDoesNotThrow(task.getValue()::run);
            assertEquals(2, logs.events.list.size());
            logs.assertSafe();
        }
    }

    @Test void runFailureDoesNotCopyFreeTextIntoLogs() {
        var dao = mock(AuditRunDao.class);
        try (var logs = new Capture(AuditRunService.class)) {
            new AuditRunService(dao, new TokenService(), new ObjectMapper()).fail(42, URL, "claim");
            logs.assertSafe();
            assertTrue(logs.events.list.getFirst().getFormattedMessage().contains("runId=42"));
            verify(dao).markFailed(eq(42L), any(), eq(URL), eq("claim"));
        }
    }

    @Test void externalFailuresPreserveTheExceptionContractButOnlyLogOriginAndType() {
        try (var logs = new Capture(ExternalServiceCall.class)) {
            var failure = new IllegalStateException(URL, new RuntimeException(SECRET));
            assertSame(failure, assertThrows(IllegalStateException.class,
                () -> ExternalServiceCall.timed(logs.logger, "lighthouse", URL, () -> { throw failure; })));
            logs.assertSafe();
            assertTrue(logs.events.list.stream().allMatch(event -> event.getFormattedMessage().contains("target=https://example.com")));
        }
    }

    @Test void collectorCorrelationAllowsOnlyBoundedNumericRunIds() {
        var previous = MDC.getCopyOfContextMap();
        try {
            MDC.clear();
            assertTrue(ExternalServiceCall.correlationHeaders().isEmpty());
            MDC.put("runId", "42"); MDC.put("secret", SECRET);
            assertEquals(Map.of("X-Argos-Run-Id", "42"), ExternalServiceCall.correlationHeaders());
            for (String invalid : new String[]{URL, "42\r\n" + SECRET, "0", "-1", "1".repeat(20)}) {
                MDC.put("runId", invalid);
                assertTrue(ExternalServiceCall.correlationHeaders().isEmpty());
            }
        } finally { if (previous == null) MDC.clear(); else MDC.setContextMap(previous); }
    }

    @Test void bothCollectorClientsSendCorrelationWithoutChangingTheAuditedUrl() throws Exception {
        var mapper = new ObjectMapper();
        var http = mock(com.dokor.argos.services.analysis.ExternalHttpClient.class);
        when(http.postJson(any(), anyString(), anyString(), any(), any(), anyLong(), anyMap()))
            .thenReturn(mapper.readTree("{\"url\":\"https://example.com\",\"finalUrl\":\"https://example.com\",\"console\":{\"errors\":0}}"));
        var config = new ConfigurationService(com.typesafe.config.ConfigFactory.empty());
        var previous = MDC.getCopyOfContextMap();
        try {
            MDC.put("runId", "42");
            new com.dokor.argos.services.analysis.modules.runtime.PlaywrightRuntimeClient(mapper, http, config).analyzeRuntime(URL);
            new com.dokor.argos.services.analysis.modules.lighthouse.LighthouseClient(mapper, http, config).analyze(URL);
            var body = ArgumentCaptor.forClass(String.class);
            verify(http, times(2)).postJson(any(), body.capture(), eq("application/json"), any(), any(), anyLong(),
                eq(Map.of("X-Argos-Run-Id", "42")));
            for (String payload : body.getAllValues()) assertEquals(URL, mapper.readTree(payload).get("url").asText());
        } finally { if (previous == null) MDC.clear(); else MDC.setContextMap(previous); }
    }

    private static class Capture implements AutoCloseable {
        final Logger logger;
        final ListAppender<ILoggingEvent> events = new ListAppender<>();
        final boolean additive;
        Capture(Class<?> owner) {
            logger = (Logger) LoggerFactory.getLogger(owner);
            additive = logger.isAdditive(); logger.setAdditive(false);
            events.start(); logger.addAppender(events);
        }
        void assertSafe() {
            assertFalse(events.list.isEmpty());
            for (var event : events.list) {
                assertFalse(event.getFormattedMessage().contains(SECRET));
                assertFalse(event.getFormattedMessage().contains("/reset/"));
                assertNull(event.getThrowableProxy());
            }
        }
        public void close() { logger.detachAppender(events); logger.setAdditive(additive); events.stop(); }
    }
}
