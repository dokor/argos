package com.dokor.argos.services.analysis;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.modules.tech.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.report.PublicReportComposer;
import com.dokor.argos.services.domain.report.ReportDto;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DomainAnalysisServiceTest {
    private final TechModuleAnalyzer analyzer = spy(new TechModuleAnalyzer(new NextJsDetectorService()));
    private final DomainAnalysisService service = new DomainAnalysisService(analyzer);

    @Test
    void twoPathsUseCurrentHeadersEvidenceRecommendationsAndScore() {
        var first = run(context("/a", "Apache/2.4.1", "<html/>"));
        var second = run(context("/b", "nginx", "<html/>"));
        assertEquals(AuditStatus.WARN, disclosure(first).status());
        assertEquals(List.of("Server: Apache/2.4.1"), disclosure(first).details().get("exposed"));
        assertNotNull(disclosure(first).recommendation());
        assertClean(second);
        assertEquals("https://example.com/b", second.data().get("finalUrl"));
        assertEquals("nginx", second.data().get("serverHeader"));
        assertTrue(score(second) > score(first));
        assertEquals(1, report(first).issues().size());
        assertTrue(report(first).issues().getFirst().evidence().contains("Apache/2.4.1"));
        assertTrue(report(second).issues().isEmpty());
        assertNull(report(second).tech().stackCache());
    }

    @Test
    void correctionAndNewDisclosureOnSamePageInvalidateOldFindings() {
        var warning = run(context("/a", "Apache/2.4.1", "<html/>"));
        var corrected = run(context("/a", "nginx", "<html/>"));
        var newWarning = run(context("/a", "nginx/1.18.0", "<html/>"));
        assertClean(corrected);
        assertTrue(score(corrected) > score(warning));
        assertEquals(AuditStatus.WARN, disclosure(newWarning).status());
        assertEquals(List.of("Server: nginx/1.18.0"), disclosure(newWarning).details().get("exposed"));
        assertFalse(disclosure(newWarning).message().contains("Apache"));
    }

    @Test
    void changedFinalHostNeverReusesOtherOriginsProof() {
        run(context("/a", "nginx", "<html>wp-content</html>"));
        var redirected = context("/a", "nginx", "<html>wp-content</html>")
            .withHttpResult("https://other.example/b", 200, 1L, List.of(), Map.of("server", "nginx"), "<html>wp-content</html>");
        var result = run(redirected);
        assertEquals("https://other.example/b", result.data().get("finalUrl"));
        assertNull(report(result).tech().stackCache());
        verify(analyzer, times(2)).analyzeStack(any(), any());
    }

    @Test
    void identicalFinalPageIsAnalyzedAgainWithoutRetainingStack() {
        var context = context("/a", "nginx", "<html/>");
        run(context);
        var second = run(new AuditContext("https://example.com/alias", "https://example.com/alias", 7L)
            .withHttpResult(context.finalUrl(), 200, 1L, List.of(), context.headers(), context.body()));
        assertEquals("https://example.com/alias", second.data().get("inputUrl"));
        assertFalse(second.data().containsKey("stackCache"));
        assertNull(report(second).tech().stackCache());
        verify(analyzer, times(2)).analyzeStack(any(), any());
        verify(analyzer, times(2)).analyzeCurrentResponse(any(), any(), any());
        assertClean(second);
    }

    @Test
    void changedHtmlOnSamePageRefreshesBuildEvidence() {
        run(context("/a", "nginx", "<script id='__NEXT_DATA__'>{\"buildId\":\"old\"}</script>"));
        var result = run(context("/a", "nginx", "<script id='__NEXT_DATA__'>{\"buildId\":\"new\"}</script>"));
        assertTrue(result.data().get("nextJs").toString().contains("new"));
        assertFalse(result.data().get("nextJs").toString().contains("old"));
        verify(analyzer, times(2)).analyzeStack(any(), any());
    }

    @Test
    void failedRerunCannotFallBackToPreviousSuccessAndNextRunRetries() {
        var context = context("/a", "nginx", "<html/>");
        run(context);
        doThrow(new IllegalStateException("analysis failed")).when(analyzer).analyzeStack(any(), any());
        assertThrows(IllegalStateException.class, () -> run(context));
        doCallRealMethod().when(analyzer).analyzeStack(any(), any());
        assertClean(run(context));
        verify(analyzer, times(3)).analyzeStack(any(), any());
    }

    @Test
    void poweredByAndMissingHtmlAreReevaluated() {
        run(context("/a", "nginx", "<html/>"));
        var result = run(context("/a", "nginx", null).withHttpResult("https://example.com/a", 200, 1L, List.of(),
            Map.of("x-powered-by", "PHP/7.4.3"), null));
        assertEquals(List.of("X-Powered-By: PHP/7.4.3"), disclosure(result).value());
        assertEquals(true, result.data().get("partial"));
        assertEquals("PHP/7.4.3", result.data().get("xPoweredBy"));
        assertNull(result.data().get("serverHeader"));
    }

    @Test
    void unavailableResponseCannotReusePreviousSuccess() {
        run(context("/a", "nginx", "<html/>"));
        assertThrows(ModuleUnavailableException.class, () -> run(new AuditContext("https://example.com/a", "https://example.com/a", 7L)));
    }

    private AuditModuleResult run(AuditContext context) {
        return service.runFreshTechAnalysis(context, LoggerFactory.getLogger(getClass()));
    }

    private AuditContext context(String path, String server, String html) {
        String url = "https://example.com" + path;
        return new AuditContext(url, url, 7L).withHttpResult(url, 200, 1L, List.of(), Map.of("server", server), html);
    }

    private AuditCheckResult disclosure(AuditModuleResult result) {
        return result.checks().stream().filter(c -> c.key().equals("tech.security.version_disclosure")).findFirst().orElseThrow();
    }

    private void assertClean(AuditModuleResult result) {
        assertEquals(AuditStatus.PASS, disclosure(result).status());
        assertTrue(disclosure(result).details().isEmpty());
        assertEquals(List.of(), disclosure(result).value());
        assertNull(disclosure(result).recommendation());
    }

    private ReportDto report(AuditModuleResult result) {
        var policy = new DefaultScorePolicy();
        var modules = new ScoreEnricherService(policy).enrich(List.of(result));
        var score = new ScoreService(policy).compute(policy.version(), policy.fingerprint(), modules);
        return new PublicReportComposer().compose(new AuditReportJson(6, "https://example.com", "https://example.com",
            Instant.now(), Map.of(), modules, score));
    }

    private double score(AuditModuleResult result) {
        var policy = new DefaultScorePolicy();
        return new ScoreService(policy).compute(policy.version(), policy.fingerprint(),
            new ScoreEnricherService(policy).enrich(List.of(result))).global().ratio();
    }

}
