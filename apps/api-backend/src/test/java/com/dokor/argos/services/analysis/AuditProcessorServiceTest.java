package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.tech.TechModuleAnalyzer;
import com.dokor.argos.services.analysis.scoring.ScoreEnricherService;
import com.dokor.argos.services.analysis.scoring.ScoreService;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.*;

class AuditProcessorServiceTest {

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
            mock(TechModuleAnalyzer.class),
            mock(ScoreEnricherService.class),
            mock(ScoreService.class),
            new ObjectMapper()
        );

        svc.process(1L);

        verify(runService, never()).complete(anyLong(), anyString());
        verify(runService, never()).fail(anyLong(), anyString());
    }

    @Test
    void shouldFailWhenAuditNotFound() {
        AuditRunService runService = mock(AuditRunService.class);
        AuditDao auditDao = mock(AuditDao.class);

        // run exists with auditId=10
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
            mock(TechModuleAnalyzer.class),
            mock(ScoreEnricherService.class),
            mock(ScoreService.class),
            new ObjectMapper()
        );

        svc.process(1L);

        verify(runService).fail(eq(1L), anyString());
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
        audit.setInputUrl("http://example.com");
        audit.setNormalizedUrl(null);

        when(runService.getRun(1L)).thenReturn(Optional.of(run));
        when(auditDao.findById(10L)).thenReturn(audit);
        when(normalizer.normalize("http://example.com")).thenReturn("http://example.com");

        HttpModuleAnalyzer http = mock(HttpModuleAnalyzer.class);
        HtmlModuleAnalyzer html = mock(HtmlModuleAnalyzer.class);
        TechModuleAnalyzer tech = mock(TechModuleAnalyzer.class);
        ScoreEnricherService scoreEnricherService = mock(ScoreEnricherService.class);
        ScoreService scoreService = mock(ScoreService.class);

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

        when(http.analyze(any(AuditContext.class), any())).thenReturn(httpModule);
        when(html.analyze(any(AuditContext.class), any())).thenReturn(new AuditModuleResult("html", "HTML", "ok", Map.of(), List.of()));
        when(tech.analyze(any(AuditContext.class), any())).thenReturn(new AuditModuleResult("tech", "TECH", "ok", Map.of(), List.of()));

        AuditProcessorService svc = new AuditProcessorService(
            runService,
            auditDao,
            normalizer,
            http,
            html,
            tech,
            scoreEnricherService,
            scoreService,
            new ObjectMapper()
        );

        svc.process(1L);

        verify(normalizer).normalize("http://example.com");
        verify(runService).complete(eq(1L), anyString());
        verify(runService, never()).fail(eq(1L), anyString());
    }

    @Test
    void shouldFailWhenHttpModuleThrows() {
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
        when(http.analyze(any(AuditContext.class), any())).thenThrow(new RuntimeException("boom"));

        AuditProcessorService svc = new AuditProcessorService(
            runService,
            auditDao,
            mock(UrlNormalizer.class),
            http,
            mock(HtmlModuleAnalyzer.class),
            mock(TechModuleAnalyzer.class),
            mock(ScoreEnricherService.class),
            mock(ScoreService.class),
            new ObjectMapper()
        );

        svc.process(1L);

        verify(runService).fail(eq(1L), contains("boom"));
        verify(runService, never()).complete(eq(1L), anyString());
    }
}
