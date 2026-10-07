package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.modules.lighthouse.LighthouseModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.observatory.ObservatoryModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.runtime.RuntimeModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.ssl.SslLabsModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.zap.ZapModuleAnalyzer;
import com.dokor.argos.services.analysis.scoring.AuditScoreReport;
import com.dokor.argos.services.analysis.scoring.ScoreAggregate;
import com.dokor.argos.services.analysis.scoring.ScoreEnricherService;
import com.dokor.argos.services.analysis.scoring.ScoreService;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.dokor.argos.services.domain.report.ReportPublishService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import org.junit.jupiter.api.Nested;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditProcessorServiceTest {

    /**
     * ObjectMapper équivalent à celui injecté en prod : les modules Jackson (dont
     * JSR-310 pour {@link java.time.Instant}) sont enregistrés, sinon la sérialisation
     * de {@code AuditReportJson.generatedAt} échoue et le run bascule en erreur.
     */
    private static ObjectMapper objectMapper() {
        return new ObjectMapper().findAndRegisterModules();
    }

    /** Minimal non-null score so the completion path (score.global().ratio()) doesn't NPE. */
    private static AuditScoreReport emptyScore() {
        return new AuditScoreReport(1, ScoreAggregate.of("global", 0.0, 0.0), List.of(), List.of(), List.of());
    }

    /** Stubs the merge/enrich/score pipeline so process() can reach complete(). */
    private static void stubScorePipeline(ScoreEnricherService enricher, ScoreService scorer) {
        when(enricher.enrich(anyList())).thenReturn(List.of());
        when(enricher.scoringVersion()).thenReturn(1);
        when(enricher.scoringFingerprint()).thenReturn("test-rubric");
        when(scorer.compute(anyInt(), anyString(), anyList())).thenReturn(emptyScore());
    }

    @Test
    void shouldDoNothingWhenRunNotFound() {
        AuditRunService runService = mock(AuditRunService.class);
        when(runService.getRun(1L)).thenReturn(Optional.empty());

        ReportPublishService publication = mock(ReportPublishService.class);
        AuditProcessorService svc = new AuditProcessorService(
            runService,
            mock(AuditDao.class),
            mock(UrlNormalizer.class),
            mock(HttpModuleAnalyzer.class),
            mock(HtmlModuleAnalyzer.class),
            mock(RuntimeModuleAnalyzer.class),
            mock(LighthouseModuleAnalyzer.class),
            mock(ObservatoryModuleAnalyzer.class),
            mock(SslLabsModuleAnalyzer.class),
            mock(ZapModuleAnalyzer.class),
            mock(DomainAnalysisService.class),
            mock(CheckMergerService.class),
            mock(ScoreEnricherService.class),
            mock(ScoreService.class),
            objectMapper(),
            publication
        );

        svc.process(1L);

        verifyNoInteractions(publication);
        verify(runService, never()).fail(anyLong(), anyString(), nullable(String.class));
    }

    @Test
    void shouldFailWhenAuditNotFound() {
        AuditRunService runService = mock(AuditRunService.class);
        AuditDao auditDao = mock(AuditDao.class);

        var run = new com.dokor.argos.db.generated.AuditRun();
        run.setId(1L);
        run.setAuditId(10L);

        when(runService.getRun(1L)).thenReturn(Optional.of(run));
        when(auditDao.findById(10L)).thenReturn(null);

        ReportPublishService publication = mock(ReportPublishService.class);
        AuditProcessorService svc = new AuditProcessorService(
            runService,
            auditDao,
            mock(UrlNormalizer.class),
            mock(HttpModuleAnalyzer.class),
            mock(HtmlModuleAnalyzer.class),
            mock(RuntimeModuleAnalyzer.class),
            mock(LighthouseModuleAnalyzer.class),
            mock(ObservatoryModuleAnalyzer.class),
            mock(SslLabsModuleAnalyzer.class),
            mock(ZapModuleAnalyzer.class),
            mock(DomainAnalysisService.class),
            mock(CheckMergerService.class),
            mock(ScoreEnricherService.class),
            mock(ScoreService.class),
            objectMapper(),
            publication
        );

        svc.process(1L);

        verify(runService).fail(eq(1L), anyString(), nullable(String.class));
    }

    @Test
    void shouldNormalizeUrlWhenMissingAndComplete() throws Exception {
        AuditRunService runService = mock(AuditRunService.class);
        AuditDao auditDao = mock(AuditDao.class);
        UrlNormalizer normalizer = mock(UrlNormalizer.class);

        var run = new com.dokor.argos.db.generated.AuditRun();
        run.setId(1L);
        run.setAuditId(10L);

        Audit audit = new Audit();
        audit.setId(10L);
        audit.setDomainId(1L); // toujours défini en prod (AuditService.createAudit)
        audit.setInputUrl("http://example.com");
        audit.setNormalizedUrl(null);

        when(runService.getRun(1L)).thenReturn(Optional.of(run));
        when(auditDao.findById(10L)).thenReturn(audit);
        when(normalizer.normalize("http://example.com")).thenReturn("http://example.com");

        HttpModuleAnalyzer http = mock(HttpModuleAnalyzer.class);
        HtmlModuleAnalyzer html = mock(HtmlModuleAnalyzer.class);
        RuntimeModuleAnalyzer runtime = mock(RuntimeModuleAnalyzer.class);
        CheckMergerService merger = mock(CheckMergerService.class);
        ScoreEnricherService enricher = mock(ScoreEnricherService.class);
        ScoreService scorer = mock(ScoreService.class);
        stubScorePipeline(enricher, scorer);

        AuditModuleResult httpModule = new AuditModuleResult(
            "http", "HTTP", "ok",
            Map.of(
                "finalUrl", "http://example.com",
                "statusCode", 200,
                "durationMs", 10L,
                "redirectChain", List.of("http://example.com"),
                "headers", Map.of("content-type", "text/html"),
                "body", "<html><head><title>T</title></head><body><h1>A</h1></body></html>"
            ),
            List.of()
        );

        when(http.moduleId()).thenReturn("http");
        when(html.moduleId()).thenReturn("html");
        when(runtime.moduleId()).thenReturn("runtime");
        when(http.analyze(any(AuditContext.class), any())).thenReturn(httpModule);
        when(html.analyze(any(AuditContext.class), any())).thenReturn(new AuditModuleResult("html", "HTML", "ok", Map.of(), List.of()));
        when(runtime.analyze(any(AuditContext.class), any())).thenReturn(new AuditModuleResult("runtime", "RUNTIME", "ok", Map.of(), List.of()));
        when(merger.merge(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        when(enricher.enrich(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        ReportPublishService publication = mock(ReportPublishService.class);
        AuditProcessorService svc = new AuditProcessorService(
            runService,
            auditDao,
            normalizer,
            http,
            html,
            runtime,
            mock(LighthouseModuleAnalyzer.class),
            mock(ObservatoryModuleAnalyzer.class),
            mock(SslLabsModuleAnalyzer.class),
            mock(ZapModuleAnalyzer.class),
            mock(DomainAnalysisService.class),
            merger,
            enricher,
            scorer,
            objectMapper(),
            publication
        );

        svc.process(1L);

        verify(normalizer).normalize("http://example.com");
        ArgumentCaptor<String> completedJson = ArgumentCaptor.forClass(String.class);
        verify(publication).completeAndPublish(eq(1L), any(), any(), completedJson.capture(), nullable(String.class));
        var moduleIds = new java.util.ArrayList<String>();
        objectMapper().readTree(completedJson.getValue()).path("modules")
            .forEach(module -> moduleIds.add(module.path("id").asText()));
        assertEquals(List.of("http", "html", "runtime", "lighthouse", "observatory", "ssl", "zap", "tech"), moduleIds);
        assertTrue(completedJson.getValue().contains("accessibility-compliance-proposal-v1"));
        assertTrue(completedJson.getValue().contains("RULES_PENDING"));
        assertFalse(completedJson.getValue().contains("<html>"));
        verify(runService, never()).fail(eq(1L), anyString(), nullable(String.class));
    }

    /**
     * Degraded mode (issue #60): a module throwing must NOT fail the whole run.
     * The run completes, and the failing module is marked in meta.moduleStatuses
     * with meta.degraded=true.
     */
    @Test
    void shouldCompleteInDegradedModeWhenModuleThrows() {
        AuditRunService runService = mock(AuditRunService.class);
        AuditDao auditDao = mock(AuditDao.class);

        var run = new com.dokor.argos.db.generated.AuditRun();
        run.setId(1L);
        run.setAuditId(10L);

        Audit audit = new Audit();
        audit.setId(10L);
        audit.setDomainId(1L); // toujours défini en prod (AuditService.createAudit)
        audit.setInputUrl("http://example.com");
        audit.setNormalizedUrl("http://example.com");

        when(runService.getRun(1L)).thenReturn(Optional.of(run));
        when(auditDao.findById(10L)).thenReturn(audit);

        HttpModuleAnalyzer http = mock(HttpModuleAnalyzer.class);
        when(http.moduleId()).thenReturn("http");
        when(http.analyze(any(AuditContext.class), any())).thenThrow(new RuntimeException("boom"));

        CheckMergerService merger = mock(CheckMergerService.class);
        ScoreEnricherService enricher = mock(ScoreEnricherService.class);
        ScoreService scorer = mock(ScoreService.class);
        stubScorePipeline(enricher, scorer);

        ReportPublishService publication = mock(ReportPublishService.class);
        AuditProcessorService svc = new AuditProcessorService(
            runService,
            auditDao,
            mock(UrlNormalizer.class),
            http,
            mock(HtmlModuleAnalyzer.class),
            mock(RuntimeModuleAnalyzer.class),
            mock(LighthouseModuleAnalyzer.class),
            mock(ObservatoryModuleAnalyzer.class),
            mock(SslLabsModuleAnalyzer.class),
            mock(ZapModuleAnalyzer.class),
            mock(DomainAnalysisService.class),
            merger,
            enricher,
            scorer,
            objectMapper(),
            publication
        );

        svc.process(1L);

        ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
        verify(publication).completeAndPublish(eq(1L), any(), any(), jsonCaptor.capture(), nullable(String.class));
        verify(runService, never()).fail(eq(1L), anyString(), nullable(String.class));

        String json = jsonCaptor.getValue();
        assertTrue(json.contains("\"degraded\":\"true\""), "report meta should flag degraded=true");
        assertTrue(json.contains("FAILED"), "report meta should record the failing module status");
    }

    // -------------------------
    // #221 : le corps HTML brut ne doit pas être persisté
    // -------------------------

    @Test
    void stripRawBody_removesBodyKeyAndCopiesDefensively() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("finalUrl", "https://example.com");
        data.put("body", "<html>....large....</html>");
        AuditModuleResult module = new AuditModuleResult("http", "HTTP", "ok", data, List.of());

        AuditModuleResult stripped = AuditProcessorService.stripRawBody(module);

        assertFalse(stripped.data().containsKey("body"), "body doit être retiré du module persisté");
        assertEquals("https://example.com", stripped.data().get("finalUrl"));
        // Copie défensive : le module d'origine n'est pas muté.
        assertTrue(module.data().containsKey("body"));
    }

    @Test
    void stripRawBody_isNoopWhenNoBody() {
        AuditModuleResult module = new AuditModuleResult("http", "HTTP", "ok", Map.of("finalUrl", "x"), List.of());
        assertSame(module, AuditProcessorService.stripRawBody(module));
    }

    @Nested
    class ParallelRemoteModules {
        private final AuditRunService runs = mock(AuditRunService.class);
        private final ObservatoryModuleAnalyzer observatory = mock(ObservatoryModuleAnalyzer.class);
        private final SslLabsModuleAnalyzer ssl = mock(SslLabsModuleAnalyzer.class);
        private final HtmlModuleAnalyzer html = mock(HtmlModuleAnalyzer.class);
        private final RuntimeModuleAnalyzer runtime = mock(RuntimeModuleAnalyzer.class);
        private final LighthouseModuleAnalyzer lighthouse = mock(LighthouseModuleAnalyzer.class);
        private final ZapModuleAnalyzer zap = mock(ZapModuleAnalyzer.class);
        private final DomainAnalysisService domains = mock(DomainAnalysisService.class);
        private final ReportPublishService publisher = mock(ReportPublishService.class);
        private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

        private AuditModuleResult result(String id) { return new AuditModuleResult(id, id, "fixture", Map.of(), List.of()); }
        private AuditProcessorService processor(RemoteModuleExecutor remote) throws Exception {
            var dao = mock(AuditDao.class); var http = mock(HttpModuleAnalyzer.class);
            var merger = mock(CheckMergerService.class);
            var enricher = mock(ScoreEnricherService.class); var scorer = mock(ScoreService.class);
            var run = new AuditRun(); run.setAuditId(10L); run.setId(1L); run.setReportTokenHash(new byte[32]); run.setClaimToken("synthetic-worker");
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

        private void assertRuntimeFallback(java.util.function.Consumer<RuntimeModuleAnalyzer> stub,
                                           String expectedStatus) throws Exception {
            try (var remote = new RemoteModuleExecutor(Duration.ofSeconds(5))) {
                var processor = processor(remote);
                stub.accept(runtime);
                processor.process(1L);
                var report = ArgumentCaptor.forClass(AuditReportJson.class);
                verify(publisher).completeAndPublish(eq(1L), any(), report.capture(), anyString(), nullable(String.class));
                var statuses = mapper.readTree(report.getValue().meta().get("moduleStatuses"));
                assertEquals(expectedStatus, statuses.path("runtime").asText());
                assertEquals("COMPLETED", statuses.path("html").asText());
                var result = report.getValue().modules().get(2);
                assertEquals(List.of("runtime.collect"), result.checks().stream().map(c -> c.key()).toList());
                assertFalse(result.checks().getFirst().scorable());
                assertEquals(false, result.data().get("available"));
                verify(runs).updateModuleStatus(1L, "runtime", "FAILED");
                verify(runs, never()).fail(anyLong(), anyString(), nullable(String.class));
            }
        }

        @Test void moduleExceptionProducesOneFallbackAndOtherModulesContinue() throws Exception {
            assertRuntimeFallback(module -> when(module.analyze(any(), any()))
                .thenThrow(new IllegalStateException("broken")), "FAILED");
        }

        @Test void nullModuleResultIsUnavailable() throws Exception {
            assertRuntimeFallback(module -> when(module.analyze(any(), any())).thenReturn(null), "UNAVAILABLE");
        }

        @Test void moduleTimeoutKeepsTimeoutReason() throws Exception {
            assertRuntimeFallback(module -> when(module.analyze(any(), any()))
                .thenThrow(new ModuleUnavailableException("late", new java.net.http.HttpTimeoutException("timeout"))), "TIMEOUT");
        }

        @Test void legacyUnavailableResultIsNormalizedWithoutDuplicateCheck() throws Exception {
            assertRuntimeFallback(module -> when(module.analyze(any(), any())).thenReturn(
                new AuditModuleResult("runtime", "Runtime", "old", Map.of("available", false, "reason", "UNAVAILABLE"),
                    List.of(com.dokor.argos.services.analysis.model.AuditCheckResult.of(
                        "runtime.available", "old", com.dokor.argos.services.analysis.model.enums.AuditStatus.WARN,
                        com.dokor.argos.services.analysis.model.enums.AuditSeverity.LOW,
                        false, 0, List.of(), false, Map.of(), "old", null)))), "UNAVAILABLE");
        }

        @Test void legacyAvailabilityCheckWithoutFlagIsAlsoNormalized() throws Exception {
            assertRuntimeFallback(module -> when(module.analyze(any(), any())).thenReturn(
                new AuditModuleResult("runtime", "Runtime", "old", Map.of(),
                    List.of(com.dokor.argos.services.analysis.model.AuditCheckResult.of(
                        "runtime.available", "old", com.dokor.argos.services.analysis.model.enums.AuditStatus.WARN,
                        com.dokor.argos.services.analysis.model.enums.AuditSeverity.LOW,
                        false, 0, List.of(), false, Map.of(), "old", null)))), "UNAVAILABLE");
        }

        @Test void partialResultKeepsItsDataWithoutAvailabilityCheck() throws Exception {
            try (var remote = new RemoteModuleExecutor(Duration.ofSeconds(5))) {
                var processor = processor(remote);
                when(runtime.analyze(any(), any())).thenReturn(
                    new AuditModuleResult("runtime", "Runtime", "partial", Map.of("partial", true), List.of()));
                processor.process(1L);
                var report = ArgumentCaptor.forClass(AuditReportJson.class);
                verify(publisher).completeAndPublish(eq(1L), any(), report.capture(), anyString(), nullable(String.class));
                assertEquals("PARTIAL", mapper.readTree(report.getValue().meta().get("moduleStatuses"))
                    .path("runtime").asText());
                assertTrue(report.getValue().modules().get(2).checks().isEmpty());
                verify(runs).updateModuleStatus(1L, "runtime", "COMPLETED");
            }
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
                    assertNotSame(localThread, Thread.currentThread()); assertTrue(started.await(2, TimeUnit.SECONDS));
                    var context = (AuditContext) call.getArgument(0);
                    assertEquals("https://example.com/final", context.finalUrl());
                    assertEquals("<p>fixture</p>", context.body());
                    release.countDown(); return result("html");
                });
                when(domains.getOrRunTechAnalysis(any(), any())).thenAnswer(call -> {
                    var context = (AuditContext) call.getArgument(0);
                    assertEquals("https://example.com/final", context.finalUrl());
                    assertEquals("<p>fixture</p>", context.body());
                    return result("tech");
                });
                processor.process(1);
                var order = inOrder(html, runtime, lighthouse, zap);
                order.verify(html).analyze(any(), any()); order.verify(runtime).analyze(any(), any());
                order.verify(lighthouse).analyze(any(), any()); order.verify(zap).analyze(any(), any());
                var report = ArgumentCaptor.forClass(AuditReportJson.class);
                verify(publisher).completeAndPublish(eq(1L), any(), report.capture(), anyString(), nullable(String.class));
                assertEquals(List.of("http", "html", "runtime", "lighthouse", "observatory", "ssl", "zap", "tech"),
                    report.getValue().modules().stream().map(AuditModuleResult::id).toList());
                 verify(runs, never()).fail(anyLong(), anyString(), nullable(String.class));
            } finally { release.countDown(); }
        }
        @Test void publicationFailureIsTerminalInsteadOfSilentlyCompleting() throws Exception {
            try (var remote = new RemoteModuleExecutor(Duration.ofSeconds(5))) {
                var processor = processor(remote);
                when(publisher.completeAndPublish(eq(1L), any(), any(), anyString(), eq("synthetic-worker")))
                    .thenThrow(new IllegalStateException("Synthetic publication failure"));
                when(runs.fail(1L,"AUDIT_PROCESSING_FAILED","synthetic-worker")).thenReturn(true);
                processor.process(1);
                verify(runs).fail(1L,"AUDIT_PROCESSING_FAILED","synthetic-worker");
                verify(runs).failRunningModules(1L);
            }
        }
        @Test void globalDeadlinePublishesObtainedResultsSkipsRemainingWorkAndLeavesNoRunningModule() throws Exception {
            var stopped=new CountDownLatch(1);
            try(var remote=new RemoteModuleExecutor(Duration.ofSeconds(5)); var local=new AuditModuleExecutor(Duration.ofSeconds(2))) {
                var processor=processor(remote); processor.configureAuditModuleExecutor(local);
                when(html.analyze(any(),any())).thenAnswer(call -> {
                    try { new CountDownLatch(1).await(); return result("html"); }
                    finally { stopped.countDown(); }
                });
                processor.process(1);
                assertTrue(stopped.await(2,TimeUnit.SECONDS));
                verify(runtime,never()).analyze(any(),any());
                var report=ArgumentCaptor.forClass(AuditReportJson.class);
                verify(publisher).completeAndPublish(eq(1L),any(),report.capture(),anyString(),eq("synthetic-worker"));
                var statuses=mapper.readTree(report.getValue().meta().get("moduleStatuses"));
                assertEquals("COMPLETED",statuses.path("http").asText());
                assertEquals("TIMEOUT",statuses.path("html").asText());
                assertEquals("TIMEOUT",statuses.path("runtime").asText());
                assertEquals("true",report.getValue().meta().get("degraded"));
                statuses.forEach(value -> assertNotEquals("RUNNING",value.asText()));
            }
        }
        @Test void remoteDeadlineProducesPartialReportAndNeverWritesProgressFromCancelledWorker() throws Exception {
            var started = new CountDownLatch(1);
            var stopped = new CountDownLatch(1);
            // Allow initial Mockito/JaCoCo class loading, then prove cancellation of an active call.
            try (var remote = new RemoteModuleExecutor(Duration.ofSeconds(2))) {
                var processor = processor(remote);
                when(ssl.analyze(any(), any())).thenAnswer(call -> {
                    started.countDown();
                    try { new CountDownLatch(1).await(); return result("ssl"); }
                    finally { stopped.countDown(); }
                });
                when(html.analyze(any(), any())).thenAnswer(call -> {
                    assertTrue(started.await(5, TimeUnit.SECONDS));
                    return result("html");
                });
                processor.process(1);
                assertTrue(stopped.await(2, TimeUnit.SECONDS));
                var report = ArgumentCaptor.forClass(AuditReportJson.class);
                verify(publisher).completeAndPublish(eq(1L), any(), report.capture(), anyString(), nullable(String.class));
                assertEquals("true", report.getValue().meta().get("degraded"));
                assertEquals("TIMEOUT", mapper.readTree(report.getValue().meta().get("moduleStatuses")).path("ssl").asText());
                verify(runs).updateModuleStatus(1L, "ssl", "RUNNING");
                verify(runs).updateModuleStatus(1L, "ssl", "FAILED");
                verify(runs, never()).updateModuleStatus(1L, "ssl", "COMPLETED");
                assertFalse(report.getValue().modules().get(5).checks().getFirst().scorable());
            }
        }

        @Test void syntheticLatencyFixtureMeasuresSerialStagesAndParallelRun() throws Exception {
            // Controlled delays, not a production benchmark. No fragile elapsed-time assertion.
            int delayMs = 200;
            try (var remote = new RemoteModuleExecutor(Duration.ofSeconds(5))) {
                var processor = processor(remote);
                when(html.analyze(any(), any())).thenAnswer(call -> { Thread.sleep(delayMs); return result("html"); });
                when(observatory.analyze(any(), any())).thenAnswer(call -> { Thread.sleep(delayMs); return result("observatory"); });
                when(ssl.analyze(any(), any())).thenAnswer(call -> { Thread.sleep(delayMs); return result("ssl"); });
                var context = new AuditContext("https://example.com", "https://example.com", 1L);
                var logger = org.slf4j.LoggerFactory.getLogger("latency-fixture");
                long serialStart = System.nanoTime();
                html.analyze(context, logger);
                observatory.analyze(context, logger);
                ssl.analyze(context, logger);
                long serialMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - serialStart);
                clearInvocations(html, observatory, ssl);
                long parallelStart = System.nanoTime();
                processor.process(1L);
                long parallelMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - parallelStart);
                verify(html).analyze(any(), any());
                verify(observatory).analyze(any(), any());
                verify(ssl).analyze(any(), any());

                verify(publisher).completeAndPublish(eq(1L), any(), any(), anyString(), nullable(String.class));
                System.out.printf("remote_fixture delayPerStageMs=%d serialStagesMs=%d parallelRunMs=%d%n",
                    delayMs, serialMs, parallelMs);
            }
        }
    }
}
