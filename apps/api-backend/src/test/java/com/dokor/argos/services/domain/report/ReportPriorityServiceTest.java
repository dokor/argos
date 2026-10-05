package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ReportPriorityServiceTest {
    private static AuditCheckResult check(String key, AuditStatus status, AuditSeverity severity,
                                          double weight, String domain, Map<String, Object> details) {
        return AuditCheckResult.of(key, key, status, severity, true, weight, List.of(domain),
            null, details, "impact", "recommendation");
    }
    private static AuditModuleResult module(String id, AuditCheckResult... checks) {
        return new AuditModuleResult(id, id, "", Map.of(), List.of(checks));
    }
    private static ReportDto compose(List<AuditModuleResult> modules) {
        return compose(modules, new ScoreService().compute(10, modules));
    }
    private static ReportDto compose(List<AuditModuleResult> modules, AuditScoreReport score) {
        return new PublicReportComposer().compose(new AuditReportJson(6, "https://example.com",
            "https://example.com", Instant.EPOCH, Map.of(), modules, score));
    }
    private static AuditCheckResult fail(String key, double weight, String domain) {
        return check(key, AuditStatus.FAIL, AuditSeverity.HIGH, weight, domain, Map.of());
    }

    @Test void lowerSeverityWithLargerGlobalContributionWins() {
        var dto = compose(List.of(module("m",
            fail("security-small", 1, "security"),
            check("security-pass", AuditStatus.PASS, AuditSeverity.LOW, 99, "security", Map.of()),
            check("performance-large", AuditStatus.WARN, AuditSeverity.LOW, 10, "performance", Map.of()))));
        var first = dto.summary().priorities().getFirst();
        assertEquals("performance-large", first.findingKey());
        assertEquals(5, first.scoreLoss());
        assertEquals(50, first.domainScoreGain());
        assertEquals(25, first.globalScoreGain()); // two domains: effective weight 0.5, not configured 0.25
        assertEquals("MODELLED_SCORE_GAIN", first.rankReason());
        assertEquals(1, first.rank());
        assertEquals("priority-impact-v1", first.rankingVersion());
        assertEquals("security-small", dto.issues().getFirst().id()); // Hero source stays severity-sorted
    }

    @Test void gainUsesPersistedContinuousRatioAndEffectiveDomainWeights() {
        var dto = compose(List.of(module("lighthouse",
            fail("lighthouse.score.performance", 10, "performance").withScoreRatio(0.8))));
        var priority = dto.summary().priorities().getFirst();
        assertEquals(2, priority.scoreLoss(), 1e-9);
        assertEquals(20, priority.globalScoreGain(), 1e-9);
    }

    @Test void zeroWeightRemainsActionableWithoutClaimingScoreGain() {
        var dto = compose(List.of(module("m", fail("zero", 0, "a11y"),
            check("measured", AuditStatus.WARN, AuditSeverity.LOW, 10, "performance", Map.of()))));
        assertEquals("measured", dto.summary().priorities().getFirst().findingKey());
        var zero = dto.summary().priorities().get(1);
        assertEquals("NO_DIRECT_SCORE_GAIN", zero.rankReason());
        assertNull(zero.scoreLoss());
        assertNull(zero.domainScoreGain());
        assertNull(zero.globalScoreGain());
        assertNull(zero.effort());
        assertEquals("UNKNOWN", zero.confidence());
    }

    @Test void tiesUseExplicitConfidenceEffortAndStableKeys() {
        var dto = compose(List.of(module("m",
            fail("a", 1, "security"),
            check("b", AuditStatus.FAIL, AuditSeverity.HIGH, 1, "security", Map.of("measurementConfidence", "HIGH", "estimatedEffort", "L")),
            check("c", AuditStatus.FAIL, AuditSeverity.HIGH, 1, "security", Map.of("measurementConfidence", "HIGH", "estimatedEffort", "S")),
            check("d", AuditStatus.FAIL, AuditSeverity.HIGH, 1, "security", Map.of("measurementConfidence", "invented", "estimatedEffort", "immediate")))));
        assertEquals(List.of("c", "b", "a", "d"), dto.summary().priorities().stream().map(ReportDto.Priority::findingKey).toList());
        assertEquals(ReportDto.Effort.S, dto.summary().priorities().getFirst().effort());
        assertNull(dto.issues().stream().filter(i -> i.id().equals("d")).findFirst().orElseThrow().effort());
    }

    @Test void canonicalMultiSourceCausesAndCoveredObservatoryAggregateUseOneSlotPerFix() {
        var csp = fail("http.security.csp", 10, "security").withSources(List.of("http", "zap"));
        var hsts = fail("http.security.hsts", 8, "security");
        var observatory = check("observatory.score", AuditStatus.FAIL, AuditSeverity.HIGH, 8, "security",
            Map.of("failedPolicies", List.of("content-security-policy", "strict-transport-security")));
        var dto = compose(List.of(module("http", csp, hsts), module("observatory", observatory)));
        assertEquals(3, dto.issues().size());
        assertEquals(2, dto.summary().priorities().size());
        var first = dto.summary().priorities().getFirst();
        assertEquals("http.security.csp", first.rootCauseKey());
        assertEquals(List.of("http", "observatory", "zap"), first.sources());
        assertEquals(List.of("http.security.csp", "observatory.score"), first.relatedFindingKeys());
        assertEquals(100.0 * 10 / 26, first.globalScoreGain(), 1e-9); // no speculative Observatory gain added
    }

    @Test void unknownOrUncoveredObservatoryPolicyDoesNotHideAnIndependentAction() {
        for (var policies : List.of(List.of("content-security-policy", "unknown-policy"),
                List.of("strict-transport-security"), List.<String>of())) {
            var dto = compose(List.of(module("http", fail("http.security.csp", 10, "security")),
                module("observatory", check("observatory.score", AuditStatus.FAIL, AuditSeverity.HIGH, 8,
                    "security", Map.of("failedPolicies", policies)))));
            assertEquals(2, dto.summary().priorities().size());
        }
    }

    @Test void sixDistinctActionsAreStableWhenModuleAndCheckOrderChanges() {
        var checks = new ArrayList<AuditCheckResult>();
        for (int i=7; i>=0; i--) checks.add(fail("finding-" + i, 1, "seo"));
        var first = compose(List.of(module("m", checks.toArray(AuditCheckResult[]::new))));
        Collections.reverse(checks);
        var second = compose(List.of(module("m", checks.toArray(AuditCheckResult[]::new))));
        assertEquals(first.summary().priorities(), second.summary().priorities());
        assertEquals(6, first.summary().priorities().size());
        assertEquals("finding-0", first.summary().priorities().getFirst().findingKey());
    }

    @Test void missingHistoricalContributionIsNeverRecomputedAndOldPrioritiesDeserialize() throws Exception {
        var dto = compose(List.of(module("m", fail("legacy", 10, "seo"))),
            new AuditScoreReport(1, ScoreAggregate.of("global", 50, 100), List.of(), List.of(), List.of()));
        assertEquals("SCORE_UNAVAILABLE", dto.summary().priorities().getFirst().rankReason());
        assertNull(dto.summary().priorities().getFirst().globalScoreGain());
        var mapper = new ObjectMapper();
        var historical = mapper.readValue("{\"severity\":\"critical\",\"title\":\"Old\",\"impact\":\"Old\",\"effort\":\"M\"}",
            ReportDto.Priority.class);
        assertNull(historical.findingKey());
        assertNull(historical.rankReason());
        assertEquals(ReportDto.Effort.M, historical.effort());
        assertEquals(dto.summary().priorities().getFirst(),
            mapper.readValue(mapper.writeValueAsString(dto.summary().priorities().getFirst()), ReportDto.Priority.class));
    }
}
