package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.CheckMergerService;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class MeasurementProvenanceTest {
    private static final String HSTS = "http.security.hsts";
    private final ScorePolicy policy = new DefaultScorePolicy();
    private AuditCheckResult check(String key, AuditStatus status, Map<String, Object> details) {
        return AuditCheckResult.of(key, key, status, AuditSeverity.MEDIUM, true, 99,
            List.of(), status != AuditStatus.INFO, details, status.name(), "fix " + status);
    }
    private AuditModuleResult module(String id, Map<String, Object> data, AuditCheckResult... checks) {
        return new AuditModuleResult(id, id, null, data, List.of(checks));
    }
    private AuditScoreReport score(List<AuditModuleResult> raw) {
        var merged = new CheckMergerService().merge(raw);
        var enriched = new ScoreEnricherService(policy).enrich(merged);
        // Availability is identical before and after scoring metadata enrichment.
        assertEquals(MeasurementCoverageService.compute(policy, merged), MeasurementCoverageService.compute(policy, enriched));
        return new ScoreService(policy).compute(policy.version(), policy.fingerprint(), enriched);
    }
    private MeasurementCoverage.Check coverage(AuditScoreReport score, String key) {
        return score.coverage().checks().stream().filter(c -> key.equals(c.key())).findFirst().orElseThrow();
    }
    private ScoredCheck scored(AuditScoreReport score, String key) {
        return score.checks().stream().filter(c -> key.equals(c.key())).findFirst().orElseThrow();
    }

    @Test
    void unavailableHttpDoesNotInvalidateTheUniqueSslObservation() {
        var result = score(List.of(module("http", Map.of("statusCode", 0)),
            module("ssl", Map.of(), check(HSTS, AuditStatus.FAIL, Map.of()))));
        var coverage = coverage(result, HSTS);
        assertEquals(MeasurementCoverage.State.MEASURED, coverage.state());
        assertEquals("http", coverage.module()); // rubric owner
        assertEquals("ssl", coverage.measurementModule()); // actual measurement
        assertEquals(List.of("ssl"), coverage.measurementSources());
        assertEquals(8, scored(result, HSTS).weight());
        assertEquals(0, scored(result, HSTS).score());
        assertEquals("ssl", scored(result, HSTS).moduleId());
    }

    @Test
    void independentSslWinsOverAnUnavailableOwnerAfterFusionInEitherOrder() {
        var http = module("http", Map.of("statusCode", 0), check(HSTS, AuditStatus.FAIL, Map.of("http", "unavailable")));
        var ssl = module("ssl", Map.of(), check(HSTS, AuditStatus.PASS, Map.of("ssl", "measured")));
        for (var raw : List.of(List.of(http, ssl), List.of(ssl, http))) {
            var result = score(raw);
            assertEquals(AuditStatus.PASS, scored(result, HSTS).status());
            assertEquals(8, scored(result, HSTS).score());
            assertEquals("http", scored(result, HSTS).moduleId()); // stable carrier
            assertEquals("ssl", coverage(result, HSTS).measurementModule());
            assertEquals(List.of("ssl"), coverage(result, HSTS).measurementSources());
            var merged = new CheckMergerService().merge(raw).stream().flatMap(m -> m.checks().stream()).findFirst().orElseThrow();
            assertEquals(List.of("http", "ssl"), merged.sources());
            assertFalse(merged.details().containsKey("http"));
            assertEquals("measured", merged.details().get("ssl"));
        }
        assertEquals(score(List.of(http, ssl)).coverage(), score(List.of(ssl, http)).coverage());
    }

    @Test
    void antibotDoesNotBlockTlsOrIndependentHeaderMeasurement() {
        var raw = List.of(module("http", Map.of("antiBotDetected", true), check(HSTS, AuditStatus.FAIL, Map.of())),
            module("ssl", Map.of(), check(HSTS, AuditStatus.PASS, Map.of()), check("ssl.grade", AuditStatus.PASS, Map.of())));
        var result = score(raw);
        assertEquals(MeasurementCoverage.State.MEASURED, coverage(result, HSTS).state());
        assertEquals(MeasurementCoverage.State.MEASURED, coverage(result, "ssl.grade").state());
        assertEquals(8, scored(result, HSTS).weight());
        assertEquals(10, scored(result, "ssl.grade").weight());
        assertEquals(MeasurementCoverage.State.BLOCKED_BY_ANTIBOT, coverage(result, "html.title").state());
    }

    @Test
    void multisourceFusionIsDeterministicAndRetainsActualSources() {
        var http = module("http", Map.of(), check(HSTS, AuditStatus.PASS, Map.of("http", true)));
        var ssl = module("ssl", Map.of(), check(HSTS, AuditStatus.WARN, Map.of("ssl", true)));
        var a = new CheckMergerService().merge(List.of(http, ssl));
        var b = new CheckMergerService().merge(List.of(ssl, http));
        var ca = a.stream().flatMap(m -> m.checks().stream()).findFirst().orElseThrow();
        var cb = b.stream().flatMap(m -> m.checks().stream()).findFirst().orElseThrow();
        assertEquals(ca, cb);
        assertEquals(AuditStatus.WARN, ca.status());
        assertEquals("ssl", ca.measurementProvenance().module());
        assertEquals(List.of("http", "ssl"), ca.measurementProvenance().sources());
        assertEquals(List.of("http", "ssl"), coverage(score(List.of(http, ssl)), HSTS).measurementSources());
    }

    @Test
    void unknownAndExcludedObservationsNeverContributeOrPoisonValidMeasurements() {
        for (String state : List.of("UNKNOWN", "UNAVAILABLE", "NOT_APPLICABLE", "BLOCKED_BY_ANTIBOT")) {
            var unavailable = check(HSTS, AuditStatus.FAIL, Map.of("measurementState", state, "measurementReason", "FIXTURE"));
            var result = score(List.of(module("ssl", Map.of(), unavailable)));
            assertEquals(0, scored(result, HSTS).weight());
            assertFalse(scored(result, HSTS).scorable());
            assertNotEquals(MeasurementCoverage.State.MEASURED, coverage(result, HSTS).state());
            result = score(List.of(module("ssl", Map.of(), unavailable), module("http", Map.of(), check(HSTS, AuditStatus.PASS, Map.of()))));
            assertEquals(8, scored(result, HSTS).score());
            assertEquals(List.of("http"), coverage(result, HSTS).measurementSources());
        }
        var unknownKey = score(List.of(module("ssl", Map.of(), check("ssl.not_in_catalogue", AuditStatus.FAIL, Map.of()))));
        assertEquals(0, scored(unknownKey, "ssl.not_in_catalogue").weight());
    }

    @Test
    void unavailableMeasurementsRemainUnavailableWhenNoIndependentSourceExists() {
        var result = score(List.of(module("http", Map.of("statusCode", 0), check(HSTS, AuditStatus.FAIL, Map.of()))));
        assertEquals("HTTP_TRANSPORT_UNAVAILABLE", coverage(result, HSTS).reason());
        assertEquals(0, scored(result, HSTS).weight());
        assertTrue(coverage(result, HSTS).measurementSources().isEmpty());
    }

    @Test
    void moduleScopeExclusionUsesTheMeasurementModule() {
        var result = score(List.of(module("http", Map.of("measurementState", "NOT_APPLICABLE", "measurementReason", "FIXTURE"),
            check(HSTS, AuditStatus.FAIL, Map.of())), module("ssl", Map.of(), check(HSTS, AuditStatus.PASS, Map.of()))));
        assertEquals(MeasurementCoverage.State.MEASURED, coverage(result, HSTS).state());
        assertEquals(8, scored(result, HSTS).score());
    }

    @Test
    void missingExplicitMeasurementSourceCannotBeScored() {
        var check = check(HSTS, AuditStatus.PASS, Map.of()).withMeasurementProvenance("missing", List.of("missing"));
        var enriched = new ScoreEnricherService(policy).enrich(List.of(module("http", Map.of(), check)));
        assertFalse(enriched.getFirst().checks().getFirst().scorable());
        var coverage = MeasurementCoverageService.compute(policy, enriched).checks().stream().filter(c -> HSTS.equals(c.key())).findFirst().orElseThrow();
        assertEquals("MEASUREMENT_SOURCE_MISSING", coverage.reason());
    }

    @Test
    void provenanceSurvivesJsonAndEnrichmentAndHistoricalChecksRemainReadable() throws Exception {
        var mapper = new ObjectMapper();
        var raw = List.of(module("ssl", Map.of(), check(HSTS, AuditStatus.FAIL, Map.of())));
        var merged = new CheckMergerService().merge(raw).getFirst().checks().getFirst();
        assertEquals(merged, mapper.readValue(mapper.writeValueAsString(merged), AuditCheckResult.class));
        assertNull(mapper.readValue(mapper.writeValueAsString(check(HSTS, AuditStatus.FAIL, Map.of())), AuditCheckResult.class).measurementProvenance());
        assertEquals("weighted-coverage-v2", score(raw).coverage().version());
    }
}
