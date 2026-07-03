package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.lighthouse.LighthouseModuleAnalyzer;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class AuditProcessorServiceTest {

    /** Minimal non-null score so the completion path (score.global().ratio()) doesn't NPE. */
    private static AuditScoreReport emptyScore() {
        return new AuditScoreReport(1, ScoreAggregate.of("global", 0.0, 0.0), List.of(), List.of(), List.of());
    }

    /** Stubs the merge/enrich/score pipeline so process() can reach complete(). */
    private static void stubScorePipeline(ScoreEnricherService enricher, ScoreService scorer) {
        when(enricher.enrich(anyList())).thenReturn(List.of());
        when(enricher.scoringVersion()).thenReturn(1);
        when(scorer.compute(anyInt(), anyList())).thenReturn(emptyScore());
    }

    @Test
    void shouldDoNothingWhenRunNotFound() {
        AuditRunService runService = mock(AuditRunService.class);
        when(runService.getRun(1L)).thenReturn(Optional.empty());

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
            new ObjectMapper(),
            mock(ReportPublishService.class)
        );

        svc.process(1L);

        verify(runService, never()).complete(anyLong(), anyString());
        verify(runService, never()).fail(anyLong(), anyString());
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
            new ObjectMapper(),
            mock(ReportPublishService.class)
        );

        svc.process(1L);

        verify(runService).fail(eq(1L), anyString());
    }

    @Test
    void shouldNormalizeUrlWhenMissingAndComplete() {
        AuditRunService runService = mock(AuditRunService.class);
        AuditDao auditDao = mock(AuditDao.class);
        UrlNormalizer normalizer = mock(UrlNormalizer.class);

        var run = new com.dokor.argos.db.generated.AuditRun();
        run.setId(1L);
        run.setAuditId(10L);

        Audit audit = new Audit();
        audit.setId(10L);
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
            new ObjectMapper(),
            mock(ReportPublishService.class)
        );

        svc.process(1L);

        verify(normalizer).normalize("http://example.com");
        verify(runService).complete(eq(1L), anyString());
        verify(runService, never()).fail(eq(1L), anyString());
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
            new ObjectMapper(),
            mock(ReportPublishService.class)
        );

        svc.process(1L);

        ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
        verify(runService).complete(eq(1L), jsonCaptor.capture());
        verify(runService, never()).fail(eq(1L), anyString());

        String json = jsonCaptor.getValue();
        assertTrue(json.contains("\"degraded\":\"true\""), "report meta should flag degraded=true");
        assertTrue(json.contains("FAILED"), "report meta should record the failing module status");
    }
}
