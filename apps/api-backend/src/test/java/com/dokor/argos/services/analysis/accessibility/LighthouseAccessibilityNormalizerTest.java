package com.dokor.argos.services.analysis.accessibility;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.lighthouse.*;
import com.dokor.argos.services.domain.report.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityEvidence.*;

class LighthouseAccessibilityNormalizerTest {
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private ObjectNode fixture() throws Exception {
        return (ObjectNode) mapper.readTree("""
            {"lighthouseVersion":"13.0.0","categories":{"accessibility":{"score":0.6,
            "auditRefs":[{"id":"image-alt"},{"id":"color-contrast"},{"id":"manual-check"},
            {"id":"not-applicable"},{"id":"missing"},{"id":"error-audit"},{"id":"button-name"},
            {"id":"unknown-future"},{"id":"image-alt"}]}},
            "audits":{
            "image-alt":{"score":0,"scoreDisplayMode":"binary","details":{"type":"table","items":[
            {"node":{"snippet":"<input value='PRIVATE'>","selector":"#secret"}}]}},
            "color-contrast":{"score":0,"scoreDisplayMode":"binary"},
            "manual-check":{"score":null,"scoreDisplayMode":"manual"},
            "not-applicable":{"score":null,"scoreDisplayMode":"notApplicable"},
            "error-audit":{"score":null,"scoreDisplayMode":"error"},
            "button-name":{"score":1,"scoreDisplayMode":"binary"},
            "unknown-future":{"score":0.7,"scoreDisplayMode":"numeric"}
            }}
            """);
    }
    @Test void separatesStatesAndNeverStoresDom() throws Exception {
        var evidence = LighthouseAccessibilityNormalizer.normalize(fixture(), false);
        assertEquals(Coverage.PARTIAL, evidence.coverage());
        assertEquals(8, evidence.referencedAudits());
        assertEquals(3, evidence.failedAudits());
        for (Status s : List.of(Status.MANUAL, Status.NOT_APPLICABLE, Status.NOT_TESTED, Status.ERROR, Status.PASS))
            assertEquals(1, evidence.statusCounts().get(s));
        assertEquals(1, evidence.reportedElements());
        assertFalse(evidence.elementCountComplete());
        assertEquals(List.of("1.1.1"), evidence.findings().stream()
            .filter(f -> f.kind() == Kind.IMAGE_ALTERNATIVE).findFirst().orElseThrow().wcagCriteria());
        assertTrue(evidence.findings().stream().filter(f -> f.kind() == Kind.OTHER)
            .findFirst().orElseThrow().wcagCriteria().isEmpty());
        assertFalse(mapper.writeValueAsString(evidence).contains("PRIVATE"));
        assertFalse(mapper.writeValueAsString(evidence).contains("selector"));
        assertEquals(evidence, mapper.readValue(mapper.writeValueAsString(evidence), AccessibilityEvidence.class));
    }
    @Test void distinguishesUnavailableFromNoDetectedDefect() throws Exception {
        assertEquals(Coverage.UNAVAILABLE, LighthouseAccessibilityNormalizer.normalize(null, false).coverage());
        assertEquals(Coverage.UNAVAILABLE, LighthouseAccessibilityNormalizer.normalize(fixture(), true).coverage());
        ObjectNode lhr = fixture();
        lhr.putObject("runtimeError").put("code", "NO_FCP");
        assertEquals(Coverage.UNAVAILABLE, LighthouseAccessibilityNormalizer.normalize(lhr, false).coverage());
        lhr.remove("runtimeError");
        lhr.withObject("/categories/accessibility").putArray("auditRefs").addObject().put("id", "button-name");
        var passed = LighthouseAccessibilityNormalizer.normalize(lhr, false);
        assertEquals(Coverage.COMPLETE, passed.coverage());
        assertEquals(0, passed.failedAudits());
        assertEquals(1, passed.statusCounts().get(Status.PASS));
    }
    @Test void countsFullListDespiteIndependentCap() throws Exception {
        ObjectNode lhr = fixture();
        var refs = lhr.withObject("/categories/accessibility").putArray("auditRefs");
        for (int i=0; i<73; i++) {
            String id = "custom-" + i;
            refs.addObject().put("id", id);
            lhr.withObject("/audits").putObject(id).put("score", 0).put("scoreDisplayMode", "binary")
                .putObject("details").put("type", "table").putArray("items").addObject()
                .putObject("node").put("snippet", "excluded");
        }
        var evidence = LighthouseAccessibilityNormalizer.normalize(lhr, false);
        assertEquals(73, evidence.failedAudits());
        assertEquals(73, evidence.reportedElements());
        assertTrue(evidence.elementCountComplete());
        assertEquals(50, evidence.surfacedFindings());
        assertTrue(evidence.truncated());
    }
    @Test void rejectsMalformedScoresAndIdentifiers() throws Exception {
        var lhr = fixture();
        lhr.withObject("/audits/image-alt").put("score", "0");
        lhr.withObject("/categories/accessibility").withArray("auditRefs").addObject().put("id", "<script>secret");
        var evidence = LighthouseAccessibilityNormalizer.normalize(lhr, false);
        assertEquals(2, evidence.statusCounts().get(Status.NOT_TESTED));
        assertFalse(mapper.writeValueAsString(evidence).contains("<script>"));
    }
    @Test void persistsEvidenceWithoutAddingChecksOrDuplicatingPublicIssues() throws Exception {
        var client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenReturn(fixture());
        var module = new LighthouseModuleAnalyzer(client).analyze(
            new AuditContext("https://example.com", "https://example.com", 1), LoggerFactory.getLogger("test"));
        assertTrue(module.data().containsKey("accessibilityEvidence"));
        var internal = new AuditReportJson(6, "https://example.com", "https://example.com", Instant.now(),
            Map.of(), List.of(module), null);
        var snapshot = mapper.readValue(mapper.writeValueAsString(internal), AuditReportJson.class);
        var publicReport = new PublicReportComposer().compose(snapshot);
        assertEquals(3, publicReport.accessibilityEvidence().failedAudits());
        assertTrue(publicReport.issues().isEmpty()); // original analyzer's checks are not enriched here
        assertNull(new PublicReportComposer().compose(new AuditReportJson(6, "", "", Instant.now(),
            Map.of(), List.of(), null)).accessibilityEvidence());
    }
}
