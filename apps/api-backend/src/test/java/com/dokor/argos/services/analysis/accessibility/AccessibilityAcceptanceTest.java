package com.dokor.argos.services.analysis.accessibility;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.scoring.ScoreService;
import com.dokor.argos.services.domain.report.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityRegulatoryScopeService.*;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityEvidence.*;

/** Cross-lot contract tests, with internal verified facts fixtures, not a public facts endpoint. */
class AccessibilityAcceptanceTest {
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    static Stream<Arguments> cases() throws Exception {
        try (var input = AccessibilityAcceptanceTest.class.getResourceAsStream("/accessibility/qualification-v1.json")) {
            assertNotNull(input);
            var cases = new ArrayList<Arguments>();
            for (JsonNode fixture : MAPPER.readTree(input).path("cases"))
                for (Coverage coverage : Coverage.values())
                    cases.add(Arguments.of(fixture.path("id").asText(), fixture, coverage));
            return cases.stream();
        }
    }

    private static ObjectNode lhr() throws Exception {
        return (ObjectNode) MAPPER.readTree("""
            {"lighthouseVersion":"13.0.3","categories":{"accessibility":{"score":0.93,
            "auditRefs":[{"id":"image-alt"},{"id":"manual-check"},{"id":"not-applicable"}]}},
            "audits":{
              "image-alt":{"score":0,"scoreDisplayMode":"binary","details":{"type":"table","items":[
                {"node":{"snippet":"PRIVATE-DOM","selector":"#PRIVATE-SELECTOR"}}]}},
              "manual-check":{"score":null,"scoreDisplayMode":"manual"},
              "not-applicable":{"score":null,"scoreDisplayMode":"notApplicable"}
            }}
            """);
    }

    @ParameterizedTest(name = "{0} / {2}")
    @MethodSource("cases")
    void evidenceQualificationAndPublicSnapshotStayConsistent(String id, JsonNode fixture, Coverage requested) throws Exception {
        JsonNode runtime = fixture.path("runtime");
        boolean blocked = runtime.path("blocked").asBoolean() || requested == Coverage.UNAVAILABLE;
        ObjectNode lhr = lhr();
        if (requested == Coverage.PARTIAL) lhr.withObject("/categories/accessibility").withArray("auditRefs")
            .addObject().put("id", "missing-result");
        var evidence = LighthouseAccessibilityNormalizer.normalize(lhr, blocked);
        JsonNode facts = runtime.path("facts");
        var inputFacts = new Facts(fact(facts, "b2cService"), fact(facts, "article47Operator"),
            fact(facts, "outsideScope"), fact(facts, "exemption"), fact(facts, "scopeReviewed"));
        String html = runtime.path("html").isNull() ? null : runtime.path("html").asText();
        var scope = new AccessibilityRegulatoryScopeService().qualify(html, blocked, inputFacts);
        var compliance = new AccessibilityComplianceRiskService().assess(evidence, scope,
            AccessibilityComplianceRiskService.Rules.pending());
        var check = AuditCheckResult.of("lighthouse.score.accessibility", "Technical", AuditStatus.WARN,
            AuditSeverity.LOW, true, blocked ? 0 : 10, List.of("a11y"), null, Map.of(), "", null).withScoreRatio(0.93);
        var modules = List.of(new AuditModuleResult("lighthouse", "", "",
            Map.of("accessibilityEvidence", evidence, "accessibilityCompliance", compliance), List.of(check)));
        var score = new ScoreService().compute(10, modules);
        var internal = new AuditReportJson(6, "https://example.com", "https://example.com", Instant.EPOCH,
            Map.of(), modules, score);
        var persistedInternal = MAPPER.readValue(MAPPER.writeValueAsString(internal), AuditReportJson.class);
        var dto = new PublicReportComposer().compose(persistedInternal);
        var persistedPublic = MAPPER.readValue(MAPPER.writeValueAsString(dto), ReportDto.class);

        assertEquals(dto, persistedPublic, id);
        assertEquals(evidence, persistedPublic.accessibilityEvidence(), id);
        assertEquals(compliance, persistedPublic.accessibilityCompliance(), id);
        assertFalse(compliance.rulesValidated(), id);
        assertEquals(AccessibilityCompliance.Risk.UNKNOWN, compliance.risk(), id);
        assertEquals(AccessibilityCompliance.RiskReason.RULES_PENDING, compliance.riskReason(), id);
        assertTrue(compliance.missingInformation().contains("RULES_REVIEW"), id);
        assertEquals("accessibility-compliance-proposal-v1", compliance.accessibilityComplianceVersion(), id);
        assertEquals(blocked ? Coverage.UNAVAILABLE : requested, evidence.coverage(), id);
        if (blocked) assertNull(evidence.lighthouseScore(), id);
        else {
            assertEquals(93, evidence.lighthouseScore(), 1e-9, id);
            assertEquals(1, evidence.failedAudits(), id); // a good score still has a finding
            assertEquals(1, evidence.statusCounts().get(Status.MANUAL), id);
            assertEquals(1, evidence.statusCounts().get(Status.NOT_APPLICABLE), id);
        }
        assertFalse(MAPPER.writeValueAsString(dto).contains("PRIVATE-"), id);
    }

    static Stream<JsonNode> invalidScores() {
        return Stream.of(NullNode.instance, TextNode.valueOf("0.93"), DoubleNode.valueOf(-0.01),
            DoubleNode.valueOf(1.01), DoubleNode.valueOf(Double.NaN), DoubleNode.valueOf(Double.POSITIVE_INFINITY));
    }
    @ParameterizedTest @MethodSource("invalidScores")
    void invalidCategoryScoreCannotPretendCollectionIsComplete(JsonNode score) throws Exception {
        var lhr = lhr();
        lhr.withObject("/categories/accessibility").set("score", score);
        var evidence = LighthouseAccessibilityNormalizer.normalize(lhr, false);
        assertNull(evidence.lighthouseScore());
        assertEquals(Coverage.PARTIAL, evidence.coverage());
        assertEquals(1, evidence.failedAudits()); // retain available evidence despite score failure
    }

    @Test void rawLighthouseScoreAndArgosDomainScoreAreDistinctAndHistoricalDataIsNotInvented() throws Exception {
        var evidence = LighthouseAccessibilityNormalizer.normalize(lhr(), false);
        var lighthouse = AuditCheckResult.of("lighthouse.score.accessibility", "", AuditStatus.WARN,
            AuditSeverity.LOW, true, 10, List.of("a11y"), null, Map.of(), "", null).withScoreRatio(0.93);
        var html = AuditCheckResult.of("html.lang", "", AuditStatus.FAIL,
            AuditSeverity.MEDIUM, true, 2, List.of("a11y"), null, Map.of(), "", null);
        var modules = List.of(new AuditModuleResult("lighthouse", "", "", Map.of("accessibilityEvidence", evidence),
            List.of(lighthouse)), new AuditModuleResult("html", "", "", Map.of(), List.of(html)));
        var dto = new PublicReportComposer().compose(new AuditReportJson(6, "", "", Instant.EPOCH,
            Map.of(), modules, new ScoreService().compute(10, modules)));
        assertEquals(93, dto.accessibilityEvidence().lighthouseScore());
        assertEquals(78, dto.scores().byCategory().getFirst().score()); // (9.3/12)*100 rounded
        var oldJson = MAPPER.valueToTree(evidence);
        ((ObjectNode) oldJson).remove("lighthouseScore");
        assertNull(MAPPER.treeToValue(oldJson, AccessibilityEvidence.class).lighthouseScore());
    }
    @Test void noValidAuditReferenceDoesNotProduceAnAvailableRawScore() throws Exception {
        var lhr = lhr();
        lhr.withObject("/categories/accessibility").putArray("auditRefs").addObject().put("id", "<invalid>");
        var evidence = LighthouseAccessibilityNormalizer.normalize(lhr, false);
        assertEquals(Coverage.UNAVAILABLE, evidence.coverage());
        assertNull(evidence.lighthouseScore());
    }
    private static Fact fact(JsonNode facts, String key) throws Exception {
        return facts.has(key) ? MAPPER.treeToValue(facts.get(key), Fact.class) : null;
    }
}
