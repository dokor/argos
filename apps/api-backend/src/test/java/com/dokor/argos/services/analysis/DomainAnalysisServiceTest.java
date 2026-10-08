package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.DomainAnalysisDao;
import com.dokor.argos.db.generated.DomainAnalysis;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.modules.tech.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.dokor.argos.services.domain.report.PublicReportComposer;
import com.dokor.argos.services.domain.report.ReportDto;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DomainAnalysisServiceTest {
    private final DomainAnalysisDao dao = mock(DomainAnalysisDao.class);
    private final TechModuleAnalyzer analyzer = spy(new TechModuleAnalyzer(new NextJsDetectorService()));
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private final AtomicReference<DomainAnalysis> cache = new AtomicReference<>();
    private final DomainAnalysisService service = new DomainAnalysisService(dao, analyzer, mapper);

    @SuppressWarnings("unchecked")
    DomainAnalysisServiceTest() {
        when(dao.withLockedDomain(eq(7L), any())).thenAnswer(call ->
            ((Function<Connection, ?>) call.getArgument(1)).apply(null));
        when(dao.findFreshByDomainId(eq(7L), isNull())).thenAnswer(call -> Optional.ofNullable(cache.get()));
        doAnswer(call -> { cache.set(null); return null; }).when(dao).deleteByDomainId(eq(7L), isNull());
        when(dao.save(any(DomainAnalysis.class), isNull())).thenAnswer(call -> {
            cache.set(call.getArgument(0));
            return call.getArgument(0);
        });
    }

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
        assertFalse((Boolean) provenance(second).get("hit"));
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
        assertEquals("https://other.example/b", provenance(result).get("sourceFinalUrl"));
        assertFalse((Boolean) provenance(result).get("hit"));
        verify(analyzer, times(2)).analyzeStack(any(), any());
    }

    @Test
    void identicalFinalPageReusesOnlyStackAndKeepsOriginalDate() throws Exception {
        var context = context("/a", "nginx", "<html/>");
        var first = run(context);
        var serialized = mapper.readValue(cache.get().getResultJson(), DomainAnalysisService.TechCache.class);
        assertEquals(3, serialized.stack().checks().size());
        assertFalse(serialized.stack().data().containsKey("serverHeader"));
        assertFalse(serialized.stack().data().containsKey("finalUrl"));
        var second = run(new AuditContext("https://example.com/alias", "https://example.com/alias", 7L)
            .withHttpResult(context.finalUrl(), 200, 1L, List.of(), context.headers(), context.body()));
        assertTrue((Boolean) provenance(second).get("hit"));
        assertEquals(provenance(first).get("analyzedAt"), provenance(second).get("analyzedAt"));
        assertEquals(provenance(first).get("expiresAt"), provenance(second).get("expiresAt"));
        assertEquals("https://example.com/alias", second.data().get("inputUrl"));
        assertTrue(report(second).tech().stackCache().hit());
        assertEquals(provenance(first).get("analyzedAt"), report(second).tech().stackCache().analyzedAt());
        assertEquals(context.finalUrl(), report(second).tech().stackCache().sourceFinalUrl());
        verify(analyzer).analyzeStack(any(), any());
        verify(analyzer, times(2)).analyzeCurrentResponse(any(), any(), any());
        verify(dao).save(any(DomainAnalysis.class), isNull());
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
    void corruptAndLegacyCachesAreDeletedAndRecalculated() throws Exception {
        for (String json : List.of("{broken json", "{}", mapper.writeValueAsString(run(context("/a", "Apache/2.4.1", "<html/>"))))) {
            var entity = new DomainAnalysis();
            entity.setDomainId(7L);
            entity.setResultJson(json);
            cache.set(entity);
            assertClean(run(context("/a", "nginx", "<html/>")));
        }
    }

    @Test
    void failedRepairCommitsDeletionWithoutSavingFalseSuccess() {
        var entity = new DomainAnalysis();
        entity.setResultJson("{}");
        cache.set(entity);
        doThrow(new IllegalStateException("analysis failed")).when(analyzer).analyzeStack(any(), any());
        assertThrows(IllegalStateException.class, () -> run(context("/a", "nginx", "<html/>")));
        assertNull(cache.get());
        verify(dao, never()).save(any(DomainAnalysis.class), any());
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
        return service.getOrRunTechAnalysis(context, LoggerFactory.getLogger(getClass()));
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> provenance(AuditModuleResult result) {
        return (Map<String, Object>) result.data().get("stackCache");
    }
}
