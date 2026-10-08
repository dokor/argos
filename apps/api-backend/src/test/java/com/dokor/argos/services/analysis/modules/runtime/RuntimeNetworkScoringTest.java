package com.dokor.argos.services.analysis.modules.runtime;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.report.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real analyzer -> enrichment -> scoring -> public report regression for #327. */
class RuntimeNetworkScoringTest {
    private static final String REQUESTS = "runtime.network.request_count";
    private static final String BYTES = "runtime.network.bytes_estimated";
    private final DefaultScorePolicy policy = new DefaultScorePolicy();

    @ParameterizedTest
    @CsvSource({"false, true", "false, false", "true, true", "true, false"})
    void eachThresholdIsMonotoneWithLowAndHighInitialPerformance(boolean healthy, boolean requests) throws Exception {
        String key = requests ? REQUESTS : BYTES;
        long threshold = requests ? 120 : 3_000_000;
        AuditReportJson before = audit(healthy, requests ? (int) threshold - 1 : 120,
            requests ? 3_000_000 : threshold - 1, false);
        AuditReportJson at = audit(healthy, 120, 3_000_000, false);
        AuditReportJson after = audit(healthy, requests ? 121 : 120,
            requests ? 3_000_000 : 3_000_001, false);

        assertEquals(healthy ? 1.0 : 13.0 / 31, performance(at).ratio(), 1e-9);
        assertEquals(31, performance(before).maxScore());
        assertEquals(31, performance(at).maxScore());
        assertEquals(31, performance(after).maxScore());
        assertEquals(performance(before).ratio(), performance(at).ratio(), 1e-9);
        assertTrue(performance(after).ratio() < performance(at).ratio());
        assertTrue(after.score().global().ratio() < at.score().global().ratio());
        assertEquals(AuditStatus.PASS, scored(at, key).status());
        assertEquals(AuditStatus.WARN, scored(after, key).status());
        assertEquals(4, scored(at, key).weight());
        assertEquals(4, scored(after, key).weight());
        assertEquals(4, scored(at, key).score());
        assertEquals(2, scored(after, key).score());
        assertEquals(at.score().coverage(), after.score().coverage());
        assertEquals(MeasurementCoverage.State.MEASURED, at.score().coverage().checks().stream()
            .filter(c -> key.equals(c.key())).findFirst().orElseThrow().state());
    }

    @Test
    void simultaneousCrossingFixesTheReportedLowScoreReproduction() throws Exception {
        var at = audit(false, 120, 3_000_000, false);
        var after = audit(false, 121, 3_000_001, false);
        assertEquals(13.0 / 31, performance(at).ratio(), 1e-9);
        assertEquals(9.0 / 31, performance(after).ratio(), 1e-9);
        assertEquals(4.0 / 31, at.score().global().ratio() - after.score().global().ratio(), 1e-9);
    }

    @Test
    void actionsAndComparisonUseTheSameConstantContributions() throws Exception {
        var composer = new PublicReportComposer();
        var at = composer.compose(audit(true, 120, 3_000_000, true));
        var after = composer.compose(audit(true, 121, 3_000_001, true));
        assertFalse(at.scores().coverage().provisional());
        assertEquals(at.scores().coverage(), after.scores().coverage());
        assertTrue(at.summary().priorities().isEmpty());
        assertEquals(Set.of(REQUESTS, BYTES), after.issues().stream().map(ReportDto.Issue::id)
            .collect(java.util.stream.Collectors.toSet()));
        assertEquals(2, after.summary().priorities().size());
        double denominator = after.scores().calculation().domains().stream()
            .filter(d -> "performance".equals(d.key())).findFirst().orElseThrow().maxScore();
        for (var action : after.summary().priorities()) {
            assertEquals("performance", action.categoryKey());
            assertEquals("MODELLED_SCORE_GAIN", action.rankReason());
            assertEquals(2, action.scoreLoss());
            assertEquals(200 / denominator, action.domainScoreGain(), 1e-9);
            assertEquals(50 / denominator, action.globalScoreGain(), 1e-9);
        }
        var degradation = AuditComparisonService.compare(at, after);
        assertEquals(AuditComparisonService.Reason.COMPARABLE, degradation.reason());
        assertFalse(degradation.coverageChanged());
        assertTrue(degradation.globalDelta() < 0);
        assertEquals(2, degradation.contributions().size());
        for (var change : degradation.contributions()) {
            assertTrue(Set.of(REQUESTS, BYTES).contains(change.key()));
            assertEquals(-200 / denominator, change.domainPoints(), 1e-9);
            assertEquals(-50 / denominator, change.globalPoints(), 1e-9);
        }
        var correction = AuditComparisonService.compare(after, at);
        assertEquals(AuditComparisonService.Reason.COMPARABLE, correction.reason());
        assertTrue(correction.globalDelta() > 0);
        assertTrue(correction.contributions().stream().allMatch(c -> c.globalPoints() > 0));
    }

    @Test
    void frozenV11ReportIsNotRecalculatedOrComparedWithV12() throws Exception {
        var current = new PublicReportComposer().compose(audit(true, 120, 3_000_000, true));
        var mapper = new ObjectMapper();
        var historicalJson = mapper.valueToTree(current);
        ((ObjectNode) historicalJson.path("scores")).put("global", 73);
        var calculation = (ObjectNode) historicalJson.path("scores").path("calculation");
        calculation.put("scoringVersion", 11);
        calculation.put("scoringFingerprint", "frozen-v11");
        String frozen = mapper.writeValueAsString(historicalJson);
        var historical = mapper.readValue(frozen, ReportDto.class);

        assertEquals(12, current.scores().calculation().scoringVersion());
        var comparison = AuditComparisonService.compare(historical, current);
        assertEquals(AuditComparisonService.Reason.METHODOLOGY_CHANGED, comparison.reason());
        assertNull(comparison.globalDelta());
        assertTrue(comparison.contributions().isEmpty());
        assertEquals(73, historical.scores().global());
        assertEquals(frozen, mapper.writeValueAsString(historical));
    }

    private AuditReportJson audit(boolean healthy, int requests, long bytes, boolean allDomains) throws Exception {
        var client = mock(PlaywrightRuntimeClient.class);
        when(client.analyzeRuntime(anyString())).thenReturn(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse(
            "https://example.com", "https://example.com", new PlaywrightRuntimeClient.Timings(100L, 200L),
            new PlaywrightRuntimeClient.Console(healthy ? 0 : 11, 0, List.of(), healthy ? 0 : 11),
            new PlaywrightRuntimeClient.JsErrors(healthy ? 0 : 1, List.of()),
            new PlaywrightRuntimeClient.Network(requests, healthy ? 0 : 1, 0, healthy ? 0 : 1,
                bytes, Map.of(), List.of(), healthy ? 0 : 1, 0, healthy ? 0 : 1, 0)));
        var runtime = new RuntimeModuleAnalyzer(client).analyze(
            new AuditContext("https://example.com", "https://example.com", 1L), LoggerFactory.getLogger("test"));
        var modules = new ArrayList<AuditModuleResult>();
        modules.add(runtime);
        if (allDomains) {
            // Hold all other catalogue measurements constant and sufficient for comparison.
            Map<String, List<AuditCheckResult>> others = new TreeMap<>();
            for (String key : policy.cataloguedKeys()) {
                var rule = policy.ruleFor(null, key);
                if (!rule.applicability().contributesToScore() || key.startsWith("runtime.")) continue;
                String module = rule.technicalSource().tag();
                others.computeIfAbsent(module, ignored -> new ArrayList<>()).add(AuditCheckResult.of(
                    key, key, AuditStatus.PASS, AuditSeverity.LOW, false, 0, List.of(module),
                    1, Map.of(), "Measured", null));
            }
            others.forEach((id, checks) -> modules.add(new AuditModuleResult(id, id, "", Map.of(), checks)));
        }
        var enricher = new ScoreEnricherService(policy);
        var enriched = enricher.enrich(modules);
        var score = new ScoreService(policy).compute(enricher.scoringVersion(), enricher.scoringFingerprint(), enriched);
        return new AuditReportJson(2, "https://example.com", "https://example.com",
            Instant.EPOCH, Map.of(), enriched, score);
    }

    private static ScoreAggregate performance(AuditReportJson report) {
        return report.score().byDomain().stream().filter(d -> "performance".equals(d.id())).findFirst().orElseThrow();
    }

    private static ScoredCheck scored(AuditReportJson report, String key) {
        return report.score().checks().stream().filter(c -> key.equals(c.key())).findFirst().orElseThrow();
    }
}