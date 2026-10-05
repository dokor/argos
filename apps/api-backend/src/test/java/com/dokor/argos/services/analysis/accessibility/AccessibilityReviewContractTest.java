package com.dokor.argos.services.analysis.accessibility;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

/** The review manifest is documentary: passing this test cannot approve or activate rules. */
class AccessibilityReviewContractTest {
    @Test void eachRuleHasDatedSourcesInputsAndTraceableFixturesOrAnExplicitCoverageGap() throws Exception {
        var mapper = new ObjectMapper();
        JsonNode review = mapper.readTree(Path.of("../../docs/accessibility-review-v1.json").toFile());
        assertEquals("PROPOSED", review.path("status").asText());
        assertTrue(review.path("reviewer").isNull());
        assertTrue(review.path("reviewedAt").isNull());
        assertEquals(AccessibilityComplianceRiskService.Rules.pending().version(), review.path("runtimeVersion").asText());
        Set<String> fixtureIds = new HashSet<>();
        try (var input = getClass().getResourceAsStream("/accessibility/qualification-v1.json")) {
            assertNotNull(input);
            mapper.readTree(input).path("cases").forEach(fixture -> fixtureIds.add(fixture.path("id").asText()));
        }
        Set<String> coveredFixtures = new HashSet<>();
        Set<String> ruleIds = new HashSet<>();
        for (JsonNode rule : review.path("rules")) {
            String id = rule.path("id").asText();
            assertFalse(id.isBlank());
            assertTrue(ruleIds.add(id), id);
            assertEquals("PENDING", rule.path("decision").asText(), id);
            assertFalse(rule.path("framework").asText().isBlank(), id);
            assertDoesNotThrow(() -> LocalDate.parse(rule.path("consultedAt").asText()), id);
            assertTrue(rule.path("requiredInformation").isArray() && !rule.path("requiredInformation").isEmpty(), id);
            assertTrue(rule.path("sources").isArray() && !rule.path("sources").isEmpty(), id);
            for (JsonNode sourceId : rule.path("sources")) {
                assertTrue(review.path("sources").has(sourceId.asText()), id);
                URI uri = URI.create(review.path("sources").path(sourceId.asText()).asText());
                assertEquals("https", uri.getScheme(), id);
                assertTrue(Set.of("eur-lex.europa.eu", "www.legifrance.gouv.fr").contains(uri.getHost()), id);
                assertNull(uri.getUserInfo(), id);
            }
            assertTrue(rule.path("fixtureIds").isArray(), id);
            if (rule.path("fixtureIds").isEmpty()) assertFalse(rule.path("coverageGap").asText().isBlank(), id);
            for (JsonNode fixtureId : rule.path("fixtureIds")) {
                assertTrue(fixtureIds.contains(fixtureId.asText()), id + ": " + fixtureId);
                coveredFixtures.add(fixtureId.asText());
            }
        }
        assertEquals(Set.of("EAA-SERVICE", "EAA-COMMERCE", "EAA-MICRO", "A47-PUBLIC", "A47-MISSION",
            "A47-ENTREPRISE", "A47-ASSOCIATION", "CUMUL", "EXCEPTION", "TRANSITION", "INCONNU", "HORS-CHAMP"), ruleIds);
        assertEquals(fixtureIds, coveredFixtures);
        Set<String> decisions = new HashSet<>();
        for (JsonNode decision : review.path("decisions")) {
            assertTrue(decisions.add(decision.path("id").asText()));
            assertEquals("PENDING", decision.path("status").asText());
            assertFalse(decision.path("question").asText().isBlank());
        }
        assertEquals(6, decisions.size());
    }
}
