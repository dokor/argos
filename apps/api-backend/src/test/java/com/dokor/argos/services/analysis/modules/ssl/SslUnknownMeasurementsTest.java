package com.dokor.argos.services.analysis.modules.ssl;

import com.dokor.argos.services.analysis.CheckMergerService;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SslUnknownMeasurementsTest {
    private final DefaultScorePolicy policy = new DefaultScorePolicy();

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"status\":\"READY\",\"endpoints\":[]}",
        "{\"status\":\"READY\",\"endpoints\":[{}]}",
        "{\"status\":\"READY\",\"endpoints\":[null]}",
        "{\"endpoints\":[{\"details\":null}]}",
        "{\"endpoints\":[{\"details\":{}}]}",
        "{\"endpoints\":[{\"details\":{\"protocols\":[],\"cert\":{},\"hstsPolicy\":{}}}]}",
        "{\"endpoints\":[{\"details\":{\"protocols\":null,\"cert\":null,\"hstsPolicy\":null}}]}",
        "{\"endpoints\":[{\"grade\":false,\"details\":{\"protocols\":[{}],\"cert\":{\"issues\":false},\"hstsPolicy\":{\"status\":\"unknown\"}}}]}",
        "{\"endpoints\":[{\"grade\":{},\"details\":{\"protocols\":[null],\"cert\":{\"issues\":0.5},\"hstsPolicy\":{\"status\":false}}}]}",
        "{\"endpoints\":[{\"grade\":\"unreadable\",\"details\":{\"protocols\":\"TLS\",\"cert\":{\"issues\":\"0\",\"notAfter\":\"9999999999999\"},\"hstsPolicy\":{\"status\":\"unreadable\"}}}]}",
        "{\"endpoints\":[{\"details\":{\"protocols\":[{\"name\":\"TLS\",\"version\":1.2}],\"cert\":{\"issues\":2147483648},\"hstsPolicy\":{\"status\":{}}}}]}"
    })
    void unknownMeasurementsAreInfoUnscoredAndUnavailable(String json) throws Exception {
        var result = analyze(json);
        assertEquals(true, result.data().get("partial"));
        for (String field : List.of("tls12", "tls13", "legacyProtocolsEnabled", "certIssues", "hstsPresent")) {
            assertNull(result.data().get(field), field);
        }
        assertEquals(7, result.checks().size());
        var modules = new ScoreEnricherService(policy).enrich(List.of(result));
        for (var c : modules.getFirst().checks()) {
            assertEquals(AuditStatus.INFO, c.status(), c.key());
            assertNull(c.value(), c.key());
            assertNull(c.recommendation(), c.key());
            assertFalse(c.scorable(), c.key());
            assertEquals(0, c.weight(), c.key());
        }
        var score = new ScoreService(policy).compute(policy.version(), policy.fingerprint(), modules);
        assertEquals(0, score.global().maxScore());
        assertEquals(0, score.byDomain().stream().filter(d -> d.id().equals("security")).findFirst().orElseThrow().maxScore());
        for (String key : List.of("ssl.grade", "ssl.certificate.valid", "ssl.certificate.expiry_days",
            "ssl.protocols.tls12", "ssl.protocols.tls13", "ssl.protocols.legacy_disabled", "http.security.hsts")) {
            assertEquals(MeasurementCoverage.State.UNAVAILABLE, score.coverage().checks().stream()
                .filter(c -> key.equals(c.key())).findFirst().orElseThrow().state(), key);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"absent", "invalid", "disabled"})
    void measuredNegativeValuesKeepRealFailures(String hstsStatus) throws Exception {
        var result = analyze("{\"endpoints\":[{\"grade\":\"F\",\"details\":{"
            + "\"protocols\":[{\"name\":\"TLS\",\"version\":\"1.0\"}],"
            + "\"cert\":{\"issues\":8,\"notAfter\":1},\"hstsPolicy\":{\"status\":\"" + hstsStatus + "\",\"maxAge\":0}}}]}");
        for (String key : List.of("ssl.grade", "ssl.certificate.valid", "ssl.certificate.expiry_days",
            "ssl.protocols.tls12", "ssl.protocols.legacy_disabled")) {
            assertEquals(AuditStatus.FAIL, check(result, key).status(), key);
        }
        assertEquals(AuditStatus.WARN, check(result, "ssl.protocols.tls13").status());
        assertEquals(AuditStatus.WARN, check(result, "http.security.hsts").status());
        assertEquals(false, result.data().get("tls12"));
        assertEquals(false, result.data().get("hstsPresent"));
        var modules = new ScoreEnricherService(policy).enrich(List.of(result));
        var coverage = MeasurementCoverageService.compute(policy, modules);
        assertTrue(modules.getFirst().checks().stream().allMatch(AuditCheckResult::scorable));
        assertTrue(coverage.checks().stream().filter(c -> c.key().startsWith("ssl.") || c.key().equals("http.security.hsts"))
            .allMatch(c -> c.state() == MeasurementCoverage.State.MEASURED));
    }

    @Test
    void completePositiveMeasurementsRemainPass() throws Exception {
        var result = analyze("{\"endpoints\":[{\"grade\":\"A+\",\"details\":{"
            + "\"protocols\":[{\"name\":\"TLS\",\"version\":\"1.2\"},{\"name\":\"TLS\",\"version\":\"1.3\"}],"
            + "\"cert\":{\"issues\":0,\"notAfter\":" + (System.currentTimeMillis() + 90L * 86_400_000) + "},"
            + "\"hstsPolicy\":{\"status\":\"present\",\"maxAge\":31536000}}}]}");
        assertTrue(result.checks().stream().allMatch(c -> c.status() == AuditStatus.PASS));
        assertEquals(false, result.data().get("partial"));
        assertEquals(true, result.data().get("tls12"));
        assertEquals(true, result.data().get("hstsPresent"));
    }

    @Test
    void partialProtocolListPreservesPositiveEvidenceAndRealLegacyFailure() throws Exception {
        var result = analyze("{\"endpoints\":[{\"details\":{\"protocols\":["
            + "{\"name\":\"TLS\",\"version\":\"1.3\"},{\"name\":\"SSL\",\"version\":\"3.0\"},{}]}}]}");
        assertEquals(AuditStatus.PASS, check(result, "ssl.protocols.tls13").status());
        assertEquals(AuditStatus.FAIL, check(result, "ssl.protocols.legacy_disabled").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.protocols.tls12").status());
        assertEquals(true, result.data().get("tls13"));
        assertNull(result.data().get("tls12"));
        assertEquals(true, result.data().get("legacyProtocolsEnabled"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"status\":\"READY\",\"endpoints\":[]}",
        "{\"endpoints\":[{\"details\":{\"hstsPolicy\":{\"status\":\"unknown\"}}}]}",
        "{\"endpoints\":[{\"details\":{\"hstsPolicy\":{\"status\":\"unreadable\"}}}]}",
        "{\"endpoints\":[{\"details\":{\"hstsPolicy\":{\"status\":null}}}]}"
    })
    void unknownSslHstsCannotAlterMeasuredHttpPass(String json) throws Exception {
        var httpHsts = AuditCheckResult.of("http.security.hsts", "HSTS", AuditStatus.PASS, AuditSeverity.LOW,
            false, 0, List.of("http"), true, Map.of("header", "max-age=31536000"), "Measured HTTP HSTS", null);
        var http = new AuditModuleResult("http", "HTTP", "", Map.of(), List.of(httpHsts));
        var ssl = analyze(json);
        for (var inputs : List.of(List.of(http, ssl), List.of(ssl, http))) {
            var modules = new ScoreEnricherService(policy).enrich(new CheckMergerService().merge(inputs));
            var hsts = check(modules.stream().filter(m -> "http".equals(m.id())).findFirst().orElseThrow(), "http.security.hsts");
            assertEquals(AuditStatus.PASS, hsts.status());
            assertEquals(true, hsts.value());
            assertEquals(httpHsts.details(), hsts.details());
            assertEquals("http", hsts.measurementProvenance().module());
            assertEquals(List.of("http"), hsts.measurementProvenance().sources());
            var coverage = MeasurementCoverageService.compute(policy, modules);
            assertEquals(MeasurementCoverage.State.MEASURED, coverage.checks().stream()
                .filter(c -> "http.security.hsts".equals(c.key())).findFirst().orElseThrow().state());
        }
    }

    @Test
    void incompleteListCannotProveLegacyDisabledAndIndependentCertValiditySurvives() throws Exception {
        var result = analyze("{\"endpoints\":[{\"details\":{\"protocols\":["
            + "{\"name\":\"TLS\",\"version\":\"1.2\"},{}],"
            + "\"cert\":{\"issues\":0,\"notAfter\":false}}}]}");
        assertEquals(AuditStatus.PASS, check(result, "ssl.protocols.tls12").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.protocols.tls13").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.protocols.legacy_disabled").status());
        assertNull(result.data().get("legacyProtocolsEnabled"));
        assertEquals(AuditStatus.PASS, check(result, "ssl.certificate.valid").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.certificate.expiry_days").status());
        var modules = new ScoreEnricherService(policy).enrich(List.of(result));
        var coverage = MeasurementCoverageService.compute(policy, modules);
        assertEquals(MeasurementCoverage.State.UNAVAILABLE, coverage.checks().stream()
            .filter(c -> c.key().equals("ssl.protocols.legacy_disabled")).findFirst().orElseThrow().state());
        assertEquals(MeasurementCoverage.State.MEASURED, coverage.checks().stream()
            .filter(c -> c.key().equals("ssl.certificate.valid")).findFirst().orElseThrow().state());
    }
    private static AuditModuleResult analyze(String json) throws Exception {
        var client = mock(SslLabsClient.class);
        when(client.analyze(anyString())).thenReturn(new ObjectMapper().readTree(json));
        return new SslLabsModuleAnalyzer(client).analyze(
            new AuditContext("https://example.com", "https://example.com", 1L), LoggerFactory.getLogger("test"));
    }

    private static AuditCheckResult check(AuditModuleResult result, String key) {
        return result.checks().stream().filter(c -> key.equals(c.key())).findFirst().orElseThrow();
    }
}