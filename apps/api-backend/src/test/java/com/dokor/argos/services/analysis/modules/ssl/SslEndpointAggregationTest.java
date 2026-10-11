package com.dokor.argos.services.analysis.modules.ssl;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.report.PublicReportComposer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SslEndpointAggregationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final DefaultScorePolicy policy = new DefaultScorePolicy();

    @Test
    void aAndFInEitherOrderRetainWorstGradeAndBothAddresses() throws Exception {
        var a = endpoint("192.0.2.1", "A", 0, 90, true);
        var f = endpoint("2001:db8::1", "F", 8, 10, false);
        var af = analyze(a, f);
        var fa = analyze(f, a);
        assertEquals(af, fa);
        assertEquals(AuditStatus.FAIL, check(af, "ssl.grade").status());
        assertEquals("F", check(af, "ssl.grade").value());
        assertEquals("2001:db8::1", check(af, "ssl.grade").details().get("selectedEndpoint"));
        var evidence = evidence(af, "ssl.grade");
        assertEquals(2, evidence.size());
        assertEquals(Set.of("192.0.2.1", "2001:db8::1"), evidence.stream().map(e -> e.get("ipAddress"))
            .collect(java.util.stream.Collectors.toSet()));
        assertEquals(Set.of("A", "F"), evidence.stream().map(e -> e.get("value"))
            .collect(java.util.stream.Collectors.toSet()));
        assertEquals(score(af), score(fa));
        assertEquals(false, af.data().get("partial"));
        assertEquals(AuditStatus.FAIL, check(af, "ssl.protocols.tls12").status());
        assertEquals(AuditStatus.WARN, check(af, "ssl.protocols.tls13").status());
        assertEquals(AuditStatus.FAIL, check(af, "ssl.protocols.legacy_disabled").status());
        assertEquals(AuditStatus.WARN, check(af, "http.security.hsts").status());
    }

    @Test
    void identicalEndpointsDoNotMultiplyTheirScoreWeight() throws Exception {
        var first = endpoint("192.0.2.1", "A", 0, 90, true);
        var second = first.deepCopy().put("ipAddress", "192.0.2.2");
        var single = score(analyze(first));
        var duplicated = score(analyze(first, second));
        assertEquals(single.global(), duplicated.global());
        assertEquals(single.byDomain(), duplicated.byDomain());
        assertEquals(single.checks().size(), duplicated.checks().size());
        assertEquals(1, duplicated.global().ratio());
    }

    @Test
    void certificateAndProtocolEvidenceRemainScopedToTheirOwnEndpoint() throws Exception {
        var invalid = endpoint("192.0.2.1", "F", 8, 90, true);
        var expired = endpoint("192.0.2.2", "A", 0, -10, false);
        var result = analyze(invalid, expired);
        var validity = check(result, "ssl.certificate.valid");
        var expiry = check(result, "ssl.certificate.expiry_days");
        assertEquals("192.0.2.1", validity.details().get("selectedEndpoint"));
        assertEquals(8, validity.details().get("issues"));
        assertEquals("192.0.2.2", expiry.details().get("selectedEndpoint"));
        assertEquals(AuditStatus.FAIL, expiry.status());
        assertEquals("192.0.2.2", check(result, "ssl.protocols.tls12").details().get("selectedEndpoint"));
        assertEquals(0, evidence(result, "ssl.certificate.valid").get(1).get("details") instanceof Map<?, ?> map
            ? map.get("issues") : null);
        var modules = new ScoreEnricherService(policy).enrich(List.of(result));
        var internal = new AuditReportJson(2, "https://example.com", "https://example.com",
            Instant.EPOCH, Map.of(), modules, score(result));
        var report = new PublicReportComposer().compose(internal);
        var issue = report.issues().stream().filter(i -> i.id().equals("ssl.certificate.valid")).findFirst().orElseThrow();
        assertTrue(issue.evidence().contains("192.0.2.1"));
        assertTrue(issue.evidence().contains("192.0.2.2"));
    }

    @Test
    void unknownAddressCannotTurnHealthyAddressIntoHostnamePass() throws Exception {
        var healthy = endpoint("192.0.2.1", "A", 0, 90, true);
        var pending = MAPPER.createObjectNode().put("ipAddress", "2001:db8::1").put("progress", -1);
        var result = analyze(healthy, pending);
        assertEquals(result, analyze(pending, healthy));
        assertEquals(true, result.data().get("partial"));
        assertTrue(result.checks().stream().allMatch(c -> c.status() == AuditStatus.INFO && c.value() == null));
        assertEquals(0, score(result).global().maxScore());
        assertEquals(1, check(result, "ssl.grade").details().get("measuredEndpointCount"));
        assertEquals("NOT_EVALUATED", evidence(result, "ssl.grade").get(1).get("assessmentState"));
    }

    @Test
    void badAddressRemainsFailWhileUnknownAddressMakesCoverageProvisional() throws Exception {
        var bad = endpoint("192.0.2.1", "F", 8, 10, false);
        var unknown = MAPPER.createObjectNode().put("ipAddress", "2001:db8::1").put("progress", 20);
        var result = analyze(bad, unknown);
        assertEquals(AuditStatus.FAIL, check(result, "ssl.grade").status());
        assertEquals("F", check(result, "ssl.grade").value());
        var gradePolicy = new DefaultScorePolicy() {
            @Override public Set<String> cataloguedKeys() { return Set.of("ssl.grade"); }
        };
        var modules = new ScoreEnricherService(gradePolicy).enrich(List.of(result));
        var coverage = MeasurementCoverageService.compute(gradePolicy, modules);
        assertEquals(MeasurementCoverage.State.MEASURED, coverage.checks().getFirst().state());
        assertEquals("PARTIAL", coverage.checks().getFirst().confidence());
        assertEquals("SSL_ENDPOINTS_PARTIALLY_MEASURED", coverage.checks().getFirst().reason());
        assertTrue(coverage.global().available());
        assertEquals(1, coverage.global().ratio());
        assertFalse(coverage.global().sufficient());
        assertTrue(coverage.provisional());
        var internal = new AuditReportJson(2, "https://example.com", "https://example.com", Instant.EPOCH,
            Map.of(), modules, new ScoreService(gradePolicy).compute(gradePolicy.version(), gradePolicy.fingerprint(), modules));
        assertTrue(new PublicReportComposer().compose(internal).scores().coverage().provisional());
    }

    @Test
    void failedAssessmentIsNotARealTlsFailureOrAnUnevaluatedAddress() throws Exception {
        var failed = MAPPER.createObjectNode().put("ipAddress", "192.0.2.1")
            .put("statusMessage", "Unable to connect to the server").put("progress", -1);
        var pending = MAPPER.createObjectNode().put("ipAddress", "2001:db8::1").put("progress", -1);
        var result = analyze(failed, pending);
        assertTrue(result.checks().stream().allMatch(c -> c.status() == AuditStatus.INFO));
        assertEquals(0, score(result).global().maxScore());
        assertEquals("ASSESSMENT_FAILED", evidence(result, "ssl.grade").get(0).get("assessmentState"));
        assertEquals("NOT_EVALUATED", evidence(result, "ssl.grade").get(1).get("assessmentState"));
        assertEquals(result, analyze(pending, failed));
    }

    @Test
    void gradeOnlyReproductionDoesNotLoseSecondEndpointWithoutIp() throws Exception {
        var a = MAPPER.createObjectNode().put("grade", "A");
        var f = MAPPER.createObjectNode().put("grade", "F");
        var result = analyze(a, f);
        assertEquals(result, analyze(f, a));
        assertEquals("F", check(result, "ssl.grade").value());
        assertEquals(AuditStatus.FAIL, check(result, "ssl.grade").status());
        assertEquals(2, evidence(result, "ssl.grade").stream().map(e -> e.get("endpointId")).distinct().count());
        assertEquals(true, result.data().get("partial"));
    }
    private static ObjectNode endpoint(String ip, String grade, int issues, int days, boolean modern) {
        var endpoint = MAPPER.createObjectNode().put("ipAddress", ip).put("grade", grade).put("statusMessage", "Ready");
        var details = endpoint.putObject("details");
        details.putObject("cert").put("issues", issues).put("notAfter", Instant.now().toEpochMilli() + days * 86_400_000L + 3_600_000L);
        var protocols = details.putArray("protocols");
        protocols.addObject().put("name", "TLS").put("version", modern ? "1.2" : "1.0");
        if (modern) protocols.addObject().put("name", "TLS").put("version", "1.3");
        details.putObject("hstsPolicy").put("status", modern ? "present" : "absent").put("maxAge", modern ? 31536000 : 0);
        return endpoint;
    }

    private static AuditModuleResult analyze(JsonNode... endpoints) throws Exception {
        var response = MAPPER.createObjectNode().put("status", "READY");
        var array = response.putArray("endpoints");
        for (var endpoint : endpoints) array.add(endpoint);
        var client = mock(SslLabsClient.class);
        when(client.analyze(anyString())).thenReturn(response);
        return new SslLabsModuleAnalyzer(client).analyze(
            new AuditContext("https://example.com", "https://example.com", 1L), LoggerFactory.getLogger("test"));
    }

    private AuditScoreReport score(AuditModuleResult module) {
        var enriched = new ScoreEnricherService(policy).enrich(List.of(module));
        return new ScoreService(policy).compute(policy.version(), policy.fingerprint(), enriched);
    }

    private static AuditCheckResult check(AuditModuleResult result, String key) {
        return result.checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> evidence(AuditModuleResult result, String key) {
        return (List<Map<String, Object>>) check(result, key).details().get("endpoints");
    }
}