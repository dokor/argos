package com.dokor.argos.services.analysis;

import org.junit.jupiter.api.Test;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.scoring.MeasurementCoverage;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class MeasurementContractTest {
    private static final String REQUESTED = "https://example.com/";
    private static final String DESTINATION = "https://example.com/private?token=secret";

    @Test void executedVersionsSettingsAndThresholdsAreFrozenIndependentlyOfOutcomes() {
        assertTrue(MeasurementContract.validDigest(MeasurementImplementation.FINGERPRINT));
        var first = freeze("browser-1", 120, DESTINATION, Map.of("timeoutMs", 45000));
        assertTrue(MeasurementContract.completeFingerprint(first.fingerprint()));
        assertEquals(first, freeze("browser-1", 120, DESTINATION, Map.of("timeoutMs", 45000)));
        assertNotEquals(first.fingerprint(), freeze("browser-2", 120, DESTINATION, Map.of("timeoutMs", 45000)).fingerprint());
        assertNotEquals(first.fingerprint(), freeze("browser-1", 100, DESTINATION, Map.of("timeoutMs", 45000)).fingerprint());
        assertNotEquals(first.fingerprint(), freeze("browser-1", 120, DESTINATION, Map.of("timeoutMs", 10000)).fingerprint());
        var redirected = freeze("browser-1", 120, "https://example.com/private?token=other", Map.of("timeoutMs", 45000));
        assertEquals(first.fingerprint(), redirected.fingerprint());
        assertNotEquals(first.scopeFingerprint(), redirected.scopeFingerprint());
        assertFalse(first.evidence().toString().contains("secret"));
    }

    @Test void missingOrBlankProducerEvidenceCannotBecomeACompleteContract() {
        for (var data : List.of(Map.<String, Object>of(),
                Map.<String, Object>of("collectorMethodFingerprint", "", "collectorScopeFingerprint", "a".repeat(64)),
                Map.<String, Object>of("collectorMethodFingerprint", "a".repeat(64)))) {
            var frozen = MeasurementContract.freeze(null, REQUESTED, DESTINATION, AuditScope.full(),
                List.of(new AuditModuleResult("runtime", "", "", data, List.of())), coverage("runtime"), Map.of());
            assertNull(frozen.fingerprint());
            assertFalse(((List<?>) frozen.evidence().get("missing")).isEmpty());
        }
    }

    @Test void mergedObservationsRequireEveryActualSourceAndIgnoreUnmeasuredCollectors() {
        var runtime = new AuditModuleResult("runtime", "", "", Map.of("collectorMethodFingerprint", "a".repeat(64),
            "collectorScopeFingerprint", "b".repeat(64)), List.of());
        assertNotNull(MeasurementContract.freeze(null, REQUESTED, DESTINATION, AuditScope.full(),
            List.of(runtime), coverage("runtime"), Map.of()).fingerprint());
        var merged = new MeasurementCoverage.Check("http.security.csp", "security", "http", 10,
            MeasurementCoverage.State.MEASURED, "fixture", "HIGH", "http", List.of("http", "zap"));
        var coverage = new MeasurementCoverage("v1", .8, null, List.of(), List.of(merged), false);
        var missing = MeasurementContract.freeze(null, REQUESTED, DESTINATION, AuditScope.full(), List.of(runtime), coverage, Map.of());
        assertNull(missing.fingerprint());
        assertEquals(List.of("zap.method"), missing.evidence().get("missing"));
    }

    @Test void upstreamVersionAndCanonicalSettingsAreRequired() throws Exception {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var first = mapper.readTree("{\"engineVersion\":\"2\",\"criteriaVersion\":\"3\"}");
        assertNotNull(MeasurementContract.upstream(first, "engineVersion", "criteriaVersion"));
        assertNull(MeasurementContract.upstream(first, "unknown"));
        assertNotEquals(MeasurementContract.upstream(first, "engineVersion", "criteriaVersion"),
            MeasurementContract.upstream(mapper.readTree("{\"engineVersion\":\"2\",\"criteriaVersion\":\"4\"}"), "engineVersion", "criteriaVersion"));
        assertEquals(MeasurementContract.hash(mapper.readTree("{\"a\":1,\"b\":{\"c\":2,\"d\":3}}")),
            MeasurementContract.hash(mapper.readTree("{\"b\":{\"d\":3,\"c\":2},\"a\":1}")));
    }

    private static MeasurementContract.Frozen freeze(String version, int threshold, String destination, Map<String, Object> config) {
        var method = MeasurementContract.hash(Map.of("browser", version, "threshold", threshold));
        var runtime = new AuditModuleResult("runtime", "", "", Map.of("collectorMethodFingerprint", method,
            "collectorScopeFingerprint", MeasurementContract.scope(REQUESTED, destination)), List.of());
        return MeasurementContract.freeze(null, REQUESTED, DESTINATION, AuditScope.full(), List.of(runtime), coverage("runtime"), config);
    }

    private static MeasurementCoverage coverage(String module) {
        return new MeasurementCoverage("v1", .8, null, List.of(), List.of(new MeasurementCoverage.Check(
            "check", "performance", module, 10, MeasurementCoverage.State.MEASURED, "fixture", "HIGH")), false);
    }
    @Test void profileAndExactDestinationChangeTheFrozenContractWithoutLeakingUrls() {
        assertEquals(MeasurementContract.fingerprint(null), MeasurementContract.fingerprint(null));
        assertNotEquals(MeasurementContract.fingerprint("profile-a"), MeasurementContract.fingerprint("profile-b"));
        String first = MeasurementContract.scope("https://example.com", "https://example.com/?token=one");
        assertTrue(first.matches("[a-f0-9]{64}"));
        assertNotEquals(first, MeasurementContract.scope("https://example.com", "https://example.com/?token=two"));
        assertNull(MeasurementContract.scope("https://example.com", null));
    }
}
