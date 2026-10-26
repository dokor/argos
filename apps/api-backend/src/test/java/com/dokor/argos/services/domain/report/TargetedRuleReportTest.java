package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.*;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.modules.lighthouse.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Inputs come from installed Lighthouse classes, including real axe DOM repairs.
 * Asserts collector selection -> sanitised persistence -> composition, not text presence. */
class TargetedRuleReportTest {
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private static final String URL = "https://targeted.example/catalogue";
    @Test void allControlledRepairsRemoveTheFindingAndPreserveItsActualTargets() throws Exception {
        var corpus = mapper.readTree(getClass().getResourceAsStream("/targeted-rules/lighthouse-cases.json"));
        assertEquals(93, corpus.size());
        var exports = mapper.createArrayNode();
        for (var test : corpus) {
            String id = test.path("id").asText(), key = "lighthouse.audit." + id;
            var before = report(test, "before", corpus);
            var issue = before.issues().stream().filter(i -> key.equals(i.id())).findFirst().orElseThrow(() -> new AssertionError(id));
            var expected = ObservedEvidence.from(test.path("before").path("observedEvidence"));
            if (expected != null && !expected.items().isEmpty()) assertEquals(expected, issue.structuredEvidence().observed(), id);
            if (test.has("related")) {
                assertFalse(issue.structuredEvidence().observed().items().isEmpty(), id);
                assertTrue(issue.structuredEvidence().details().stream().anyMatch(d -> d.key().equals("relatedAudit") && d.text().equals(test.path("related").asText())), id);
            }
            if (id.equals("document-latency-insight")) assertTrue(issue.structuredEvidence().details().contains(new ReportDto.EvidenceDetail("documentCheck.serverResponseIsFast", "false")));
            var after = report(test, "after", corpus);
            assertTrue(after.issues().stream().noneMatch(i -> key.equals(i.id())), id);
            exports.addObject().put("id", id).put("method", test.path("method").asText()).set("report", mapper.valueToTree(before));
        }
        // Optional local preview. Ordinary CI does not need a running web server.
        String destination = System.getProperty("argos.targeted.export");
        if (destination != null) mapper.writerWithDefaultPrettyPrinter().writeValue(new java.io.File(destination), exports);
    }
    private ReportDto report(JsonNode test, String phase, JsonNode corpus) throws Exception {
        String id = test.path("id").asText();
        var lhr = mapper.createObjectNode().put("lighthouseVersion", "13.5.0");
        lhr.putObject("categories").putObject(test.path("category").asText()).put("score", 1).putArray("auditRefs").addObject().put("id", id).put("weight", 1);
        var audits = lhr.putObject("audits"); audits.set(id, test.path(phase));
        if (test.has("related")) {
            String related = test.path("related").asText();
            if (related.equals("long-tasks")) audits.putObject(related).set("observedEvidence", mapper.readTree("""
                {"version":"observed-evidence-v1","source":"lighthouse","items":[{"kind":"resource","origin":"https://targeted.example","resourcePath":"/assets/startup.js","resourceRef":"e90617403a96007d","metrics":{"duration":1200}}]}
                """));
            else for (var other : corpus) if (related.equals(other.path("id").asText())) audits.set(related, other.path(phase));
        }
        var client = mock(LighthouseClient.class); when(client.analyze(anyString())).thenReturn(lhr);
        var module = new LighthouseModuleAnalyzer(client).analyze(new AuditContext(URL, URL, 1L), LoggerFactory.getLogger("targeted"));
        // Exactly the sanitised serialization boundary used by audit storage.
        module = mapper.treeToValue(AuditOutputSanitizer.tree(module, mapper), AuditModuleResult.class);
        var policy = new DefaultScorePolicy();
        var modules = new ScoreEnricherService(policy).enrich(List.of(module));
        var score = new ScoreService(policy).compute(policy.version(), policy.fingerprint(), modules);
        var internal = new AuditReportJson(1, URL, URL, Instant.parse("2026-10-26T12:00:00Z"), Map.of("review", "targeted-controlled-case"), modules, score);
        return mapper.treeToValue(AuditOutputSanitizer.tree(new PublicReportComposer().compose(internal), mapper), ReportDto.class);
    }
}
