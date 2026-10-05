package com.dokor.argos.services.analysis.accessibility;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityRegulatoryScopeService.*;

class AccessibilityQualificationFixturesTest {
    @Test void documentaryCasesKeepTheRuntimeConservativeUntilHumanPublication() throws Exception {
        var mapper = new ObjectMapper();
        try (var input = getClass().getResourceAsStream("/accessibility/qualification-v1.json")) {
            assertNotNull(input);
            JsonNode contract = mapper.readTree(input);
            assertEquals(1, contract.path("accessibilityComplianceVersion").asInt());
            assertEquals("PROPOSED", contract.path("reviewStatus").asText());
            var service = new AccessibilityRegulatoryScopeService();
            var risk = new AccessibilityComplianceRiskService();
            Set<String> ids = new HashSet<>();
            for (JsonNode fixture : contract.path("cases")) {
                String id = fixture.path("id").asText();
                assertTrue(ids.add(id), id);
                assertFalse(fixture.path("legalReview").path("approved").asBoolean(), id);
                JsonNode runtime = fixture.path("runtime");
                JsonNode facts = runtime.path("facts");
                Facts inputFacts = new Facts(fact(mapper, facts, "b2cService"),
                    fact(mapper, facts, "article47Operator"), fact(mapper, facts, "outsideScope"),
                    fact(mapper, facts, "exemption"), fact(mapper, facts, "scopeReviewed"));
                String html = runtime.path("html").isNull() ? null : runtime.path("html").asText();
                var result = service.qualify(html, runtime.path("blocked").asBoolean(), inputFacts);
                List<String> expectedScopes = new ArrayList<>();
                runtime.path("scopes").forEach(s -> expectedScopes.add(s.asText()));
                assertEquals(expectedScopes, result.scopes().stream().map(Enum::name).toList(), id);
                assertEquals(runtime.path("confidence").asText(), result.confidence().name(), id);
                var snapshot = risk.assess(null, result, AccessibilityComplianceRiskService.Rules.pending());
                assertEquals(contract.path("runtimeVersion").asText(), snapshot.accessibilityComplianceVersion(), id);
                assertFalse(snapshot.rulesValidated(), id);
                assertEquals(runtime.path("risk").asText(), snapshot.risk().name(), id);
                assertEquals(runtime.path("riskReason").asText(), snapshot.riskReason().name(), id);
            }
            assertEquals(14, ids.size());
        }
    }
    private Fact fact(ObjectMapper mapper, JsonNode facts, String key) throws Exception {
        return facts.has(key) ? mapper.treeToValue(facts.get(key), Fact.class) : null;
    }
}
