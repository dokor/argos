package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.analysis.lighthouse.LighthouseModuleAnalyzer;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.observatory.ObservatoryModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.runtime.RuntimeModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.ssl.SslLabsModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.zap.ZapModuleAnalyzer;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.report.ReportPublishService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditProcessorParallelTest {
    private final AuditRunService runs = mock(AuditRunService.class);
    private final ObservatoryModuleAnalyzer observatory = mock(ObservatoryModuleAnalyzer.class);
    private final SslLabsModuleAnalyzer ssl = mock(SslLabsModuleAnalyzer.class);
    private final HtmlModuleAnalyzer html = mock(HtmlModuleAnalyzer.class);
    private final RuntimeModuleAnalyzer runtime = mock(RuntimeModuleAnalyzer.class);
    private final LighthouseModuleAnalyzer lighthouse = mock(LighthouseModuleAnalyzer.class);
    private final ZapModuleAnalyzer zap = mock(ZapModuleAnalyzer.class);
    private final ReportPublishService publisher = mock(ReportPublishService.class);
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    private AuditModuleResult result(String id) { return new AuditModuleResult(id, id, "fixture", Map.of(), List.of()); }
    private AuditProcessorService processor(RemoteModuleExecutor remote) throws Exception {
        var dao = mock(AuditDao.class); var http = mock(HttpModuleAnalyzer.class);
        var domains = mock(DomainAnalysisService.class); var merger = mock(CheckMergerService.class);
        var enricher = mock(ScoreEnricherService.class); var scorer = mock(ScoreService.class);
        var run = new AuditRun(); run.setAuditId(10L); run.setId(1L); run.setReportToken("synthetic-fixture-token");
        var audit = new Audit(); audit.setId(10L); audit.setDomainId(1L);
        audit.setInputUrl("https://example.com"); audit.setNormalizedUrl("https://example.com");
        when(runs.getRun(1)).thenReturn(Optional.of(run)); when(dao.findById(10L)).thenReturn(audit);
        when(http.analyze(any(), any())).thenReturn(new AuditModuleResult("http", "HTTP", "fixture",
            Map.of("finalUrl", "https://example.com/final", "statusCode", 200, "body", "<p>fixture</p>"), List.of()));
        when(html.analyze(any(), any())).thenReturn(result("html"));
        when(runtime.analyze(any(), any())).thenReturn(result("runtime"));
        when(lighthouse.analyze(any(), any())).thenReturn(result("lighthouse"));
        when(zap.analyze(any(), any())).thenReturn(result("zap"));
        when(domains.getOrRunTechAnalysis(any(), any())).thenReturn(result("tech"));
        when(observatory.analyze(any(), any())).thenReturn(result("observatory"));
        when(ssl.analyze(any(), any())).thenReturn(result("ssl"));
        when(merger.merge(anyList())).thenAnswer(call -> call.getArgument(0));
        when(enricher.enrich(anyList())).thenAnswer(call -> call.getArgument(0));
        when(enricher.scoringFingerprint()).thenReturn("fixture");
        when(scorer.compute(anyInt(), anyString(), anyList())).thenReturn(
            new AuditScoreReport(1, ScoreAggregate.of("global", 0, 0), List.of(), List.of(), List.of()));
        var processor = new AuditProcessorService(runs, dao, mock(UrlNormalizer.class), http, html, runtime,
            lighthouse, observatory, ssl, zap, domains, merger, enricher, scorer, mapper, publisher);
        processor.configureRemoteModuleExecutor(remote);
        return processor;
    }
    @Test void remoteCallsHaveHttpContextOverlapLocalWorkAndPublishOneOrderedReport() throws Exception {
        var started = new CountDownLatch(2); var release = new CountDownLatch(1);
        Thread localThread = Thread.currentThread();
        try (var remote = new RemoteModuleExecutor(Duration.ofSeconds(5))) {
            var processor = processor(remote);
            when(observatory.analyze(any(), any())).thenAnswer(call -> {
                assertNotSame(localThread, Thread.currentThread()); assertEquals("https://example.com/final", ((AuditContext) call.getArgument(0)).finalUrl());
                started.countDown(); assertTrue(release.await(2, TimeUnit.SECONDS)); return result("observatory");
            });
            when(ssl.analyze(any(), any())).thenAnswer(call -> {
                assertNotSame(localThread, Thread.currentThread()); assertEquals("<p>fixture</p>", ((AuditContext) call.getArgument(0)).body());
                started.countDown(); assertTrue(release.await(2, TimeUnit.SECONDS)); return result("ssl");
            });
            when(html.analyze(any(), any())).thenAnswer(call -> {
                assertSame(localThread, Thread.currentThread()); assertTrue(started.await(2, TimeUnit.SECONDS));
                release.countDown(); return result("html");
            });
            processor.process(1);
            var order = inOrder(html, runtime, lighthouse, zap);
            order.verify(html).analyze(any(), any()); order.verify(runtime).analyze(any(), any());
            order.verify(lighthouse).analyze(any(), any()); order.verify(zap).analyze(any(), any());
            var report = ArgumentCaptor.forClass(AuditReportJson.class);
            verify(publisher).publishIfAbsent(eq(1L), any(), report.capture(), eq("synthetic-fixture-token"));
            assertEquals(List.of("http", "html", "runtime", "lighthouse", "observatory", "ssl", "zap", "tech"),
                report.getValue().modules().stream().map(AuditModuleResult::id).toList());
            verify(runs).complete(eq(1L), anyString()); verify(runs, never()).fail(anyLong(), anyString());
        } finally { release.countDown(); }
    }
    @Test void remoteDeadlineProducesPartialReportAndNeverWritesProgressFromCancelledWorker() throws Exception {
        var stopped = new CountDownLatch(1);
        try (var remote = new RemoteModuleExecutor(Duration.ofMillis(100))) {
            var processor = processor(remote);
            when(ssl.analyze(any(), any())).thenAnswer(call -> {
                try { new CountDownLatch(1).await(); return result("ssl"); }
                finally { stopped.countDown(); }
            });
            processor.process(1);
            assertTrue(stopped.await(2, TimeUnit.SECONDS));
            var report = ArgumentCaptor.forClass(AuditReportJson.class);
            verify(publisher).publishIfAbsent(eq(1L), any(), report.capture(), anyString());
            assertEquals("true", report.getValue().meta().get("degraded"));
            assertEquals("TIMEOUT", mapper.readTree(report.getValue().meta().get("moduleStatuses")).path("ssl").asText());
            verify(runs).updateModuleStatus(1L, "ssl", "RUNNING");
            verify(runs).updateModuleStatus(1L, "ssl", "FAILED");
            verify(runs, never()).updateModuleStatus(1L, "ssl", "COMPLETED");
            assertFalse(report.getValue().modules().get(5).checks().getFirst().scorable());
        }
    }
}
