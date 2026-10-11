package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class ReportEvidenceTest {
    private AuditCheckResult check(String key, Object value, Map<String,Object> details) {
        return AuditCheckResult.of(key, "Technical title", AuditStatus.FAIL, AuditSeverity.HIGH,
            true, 1, List.of("performance"), value, details, "Observed", "Review");
    }
    @Test void neverTurnsALighthouseRatioIntoSeconds() {
        var result = ReportEvidence.from("lighthouse", check("lighthouse.audit.largest-contentful-paint", .02,
            Map.of("score", .02, "weight", 10)));
        assertNull(result.measurement());
        assertEquals("lighthouse", result.source());
        assertEquals(2, result.details().size());
    }
    @Test void retainsExplicitMeasurementsAndUnknownUnitsHaveNoMeasurement() {
        var result = ReportEvidence.from("lighthouse", check("lighthouse.audit.largest-contentful-paint", .02,
            Map.of("numericValue", 4800, "numericUnit", "millisecond")));
        assertEquals(4800, result.measurement().value());
        assertEquals("ms", result.measurement().unit());
        assertEquals("unitless", ReportEvidence.from("lighthouse", check("lighthouse.audit.future", .3,
            Map.of("numericValue", 4, "numericUnit", "unitless"))).measurement().unit());
        assertNull(ReportEvidence.from("lighthouse", check("lighthouse.audit.future", .3,
            Map.of("numericValue", 4, "numericUnit", "unknown"))).measurement());
        assertEquals("count", ReportEvidence.from("runtime", check("runtime.network.request_count", 140, Map.of())).measurement().unit());
        assertNull(ReportEvidence.from("http", check("http.response_time_ms", null, Map.of())).measurement());
        assertNull(ReportEvidence.from("future", check("future.check", 42, Map.of())).measurement());
    }
    @Test void boundsAndSanitisesThirdPartyEvidence() {
        assertEquals(4000, ReportEvidence.clean("a".repeat(5000)).length());
        String clean = ReportEvidence.clean("\u0001https://user:secret@example.com/path/$x?token=private#fragment");
        assertFalse(clean.contains("secret")); assertFalse(clean.contains("private"));
        assertFalse(clean.contains("fragment")); assertFalse(clean.contains("\u0001"));
        assertTrue(clean.contains("/path/$x"));
    }
    @Test void deserialisesHistoricalIssueWithoutOptionalEvidence() throws Exception {
        var old = new ObjectMapper().readValue("{\"id\":\"old\",\"title\":\"Original\",\"severity\":\"important\"}", ReportDto.Issue.class);
        assertEquals("Original", old.title()); assertNull(old.structuredEvidence());
    }
    @Test void retainsTheActualMeasurementSourceInsteadOfTheCarrier() {
        var original = check("http.response_time_ms", 120, Map.of());
        var sourced = new AuditCheckResult(original.key(), original.title(), original.status(), original.severity(),
            original.scorable(), original.weight(), original.tags(), original.value(), original.details(),
            original.message(), original.recommendation(), List.of("http", "zap"), original.scoreRatio(),
            new AuditCheckResult.MeasurementProvenance("http", List.of("http")));
        assertEquals("http", ReportEvidence.from("zap", sourced).source());
    }
}
