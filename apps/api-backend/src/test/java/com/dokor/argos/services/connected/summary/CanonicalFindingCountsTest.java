package com.dokor.argos.services.connected.summary;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CanonicalFindingCountsTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void sharesTheActualReadersHistoricalFixtureAndItsExpectedCounts() throws Exception {
        var report = mapper.readTree(java.nio.file.Path.of("../console-web/src/components/report/fixtures/historical-report.json").toFile());
        var result = DiagnosticProjection.from(report, null);
        assertEquals(6, CanonicalFindings.from(report).size());
        assertEquals(2L, result.criticalCount()); assertEquals(2L, result.importantCount());
    }
    @Test void countsAggregatesAndZeroWeightLighthouseDetailsOnceWithoutChangingScores() throws Exception {
        var fixture = SummaryFixture.fixture();
        var evidence = SummaryFixture.evidence(fixture, fixture.path("domains").get(0).path("pages").get(0));
        var before = DiagnosticProjection.from(evidence.report(), evidence.score());
        var score = evidence.score().deepCopy();
        var issues = evidence.report().withArray("issues");
        for (String key : new String[]{"lighthouse.score.performance", "lighthouse.audit.lcp", "lighthouse.audit.image-alt"}) {
            var issue = issues.addObject().put("id", key).put("categoryKey", "performance").put("module", "lighthouse")
                .put("severity", "critical").put("title", "Frozen title").put("impact", "Frozen impact").put("recommendation", "Frozen action");
            issues.add(issue.deepCopy());
        }
        var result = DiagnosticProjection.from(evidence.report(), evidence.score());
        assertEquals(before.criticalCount() + 3, result.criticalCount());
        assertEquals(before.importantCount(), result.importantCount());
        assertEquals(3, result.rules().stream().filter(r -> r.key().startsWith("lighthouse.")).count());
        assertEquals(score, evidence.score());
        assertEquals(before.coverageRatio(), result.coverageRatio());
        // Migration uses frozen report rows even when the original raw score has been purged.
        assertEquals(result.criticalCount(), DiagnosticProjection.canonical(evidence.report(), before).criticalCount());
    }
    @Test void firstPublishedIdWinsAndLegacyRowsStayDistinct() throws Exception {
        var report = mapper.readTree("""
            {"issues":[{"id":"same","severity":"critical"},{"id":"same","severity":"important"},
            {"severity":"important"},{"severity":"important"},{"id":"legacy-row-2","severity":"info"}]}
            """);
        var result = DiagnosticProjection.from(report, null);
        assertEquals(1L, result.criticalCount()); assertEquals(2L, result.importantCount());
        assertEquals(4, CanonicalFindings.from(report).size());
        assertNull(DiagnosticProjection.from(mapper.readTree("{}"), null).criticalCount());
        assertEquals(0L, DiagnosticProjection.from(mapper.readTree("{\"issues\":[]}"), null).criticalCount());
    }
}
