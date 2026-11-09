package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.lighthouse.LighthouseModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.observatory.ObservatoryModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.runtime.RuntimeModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.ssl.SslLabsModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.zap.ZapModuleAnalyzer;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.dokor.argos.services.domain.report.ReportPublishService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Controlled collector responses; the real merge, policy, scoring and coverage pipeline runs unchanged. */
class AuditLatencyParityTest {
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();
    private record Sample(AuditReportJson report, long milliseconds) {}

    private static AuditCheckResult check(String key, AuditStatus status, Object value) {
        return AuditCheckResult.of(key, key, status, AuditSeverity.MEDIUM, false, 0,
            List.of(), value, Map.of("observed", "fixture-evidence"), "Measured fixture", "Fixture action");
    }

    private static AuditModuleResult observed(String id) {
        var data = new LinkedHashMap<String, Object>();
        data.put("collectorMethodFingerprint", "a".repeat(64));
        data.put("collectorScopeFingerprint", "b".repeat(64));
        List<AuditCheckResult> checks = switch (id) {
            case "http" -> {
                data.putAll(Map.of("finalUrl", "https://example.com/final", "statusCode", 200,
                    "body", "<html lang='fr'><title>Fixture</title></html>", "responseSnapshotAvailable", true));
                yield List.of(check("http.security.csp", AuditStatus.FAIL, false),
                    check("http.security.hsts", AuditStatus.PASS, true));
            }
            case "html" -> List.of(check("html.title", AuditStatus.PASS, "Fixture"),
                check("html.lang", AuditStatus.WARN, "fr"));
            case "runtime" -> {
                data.put("timings", Map.of("loadMs", 429));
                data.put("network", Map.of("requests", 24, "totalBytesEstimated", 319685));
                yield List.of(check("runtime.network.failed_requests", AuditStatus.WARN, 2));
            }
            case "lighthouse" -> List.of(check("lighthouse.score.performance", AuditStatus.WARN, 85).withScoreRatio(.85),
                check("lighthouse.score.accessibility", AuditStatus.PASS, 100).withScoreRatio(1.0));
            case "observatory" -> List.of(check("observatory.score", AuditStatus.PASS, 100));
            case "ssl" -> List.of(check("ssl.grade", AuditStatus.WARN, "B"),
                check("ssl.certificate.valid", AuditStatus.PASS, true),
                check("ssl.certificate.expiry_days", AuditStatus.INFO, null));
            case "zap" -> List.of(check("zap.alert.10021", AuditStatus.INFO, "Informational fixture"));
            case "tech" -> List.of(check("tech.security.version_disclosure", AuditStatus.FAIL, "fixture/1.0"));
            default -> throw new IllegalArgumentException(id);
        };
        return new AuditModuleResult(id, id, "Observed fixture", data, checks);
    }

    private static AuditModuleResult collect(String module, int delay, boolean unavailable) throws Exception {
        if (delay > 0) Thread.sleep(delay);
        if (unavailable) throw new ModuleUnavailableException("Provider unavailable",
            new CollectorFailure(CollectorFailure.Code.PROVIDER_UNAVAILABLE));
        return observed(module);
    }

    private Sample run(int capacity, int scale, boolean sslUnavailable) throws Exception {
        var runs = mock(AuditRunService.class);
        var dao = mock(AuditDao.class);
        var publisher = mock(ReportPublishService.class);
        var run = new AuditRun();
        run.setId(1L); run.setAuditId(10L); run.setClaimToken("fixture-claim");
        var audit = new Audit();
        audit.setId(10L); audit.setDomainId(1L);
        audit.setInputUrl("https://example.com"); audit.setNormalizedUrl("https://example.com");
        when(runs.getRun(1)).thenReturn(Optional.of(run));
        when(dao.findById(10L)).thenReturn(audit);
        var http = mock(HttpModuleAnalyzer.class);
        var html = mock(HtmlModuleAnalyzer.class);
        var runtime = mock(RuntimeModuleAnalyzer.class);
        var lighthouse = mock(LighthouseModuleAnalyzer.class);
        var observatory = mock(ObservatoryModuleAnalyzer.class);
        var ssl = mock(SslLabsModuleAnalyzer.class);
        var zap = mock(ZapModuleAnalyzer.class);
        var tech = mock(DomainAnalysisService.class);
        when(http.analyze(any(), any())).thenAnswer(call -> collect("http", 0, false));
        when(html.analyze(any(), any())).thenAnswer(call -> collect("html", 0, false));
        when(runtime.analyze(any(), any())).thenAnswer(call -> collect("runtime", 5 * scale, false));
        when(lighthouse.analyze(any(), any())).thenAnswer(call -> collect("lighthouse", 15 * scale, false));
        when(observatory.analyze(any(), any())).thenAnswer(call -> collect("observatory", 5 * scale, false));
        when(ssl.analyze(any(), any())).thenAnswer(call -> collect("ssl", 90 * scale, sslUnavailable));
        when(zap.analyze(any(), any())).thenAnswer(call -> collect("zap", 3 * scale, false));
        when(tech.runFreshTechAnalysis(any(), any())).thenAnswer(call -> collect("tech", 0, false));
        var policy = new DefaultScorePolicy();
        try (var remote = new RemoteModuleExecutor(Duration.ofSeconds(10), capacity);
             var local = new AuditModuleExecutor(Duration.ofSeconds(20))) {
            var processor = new AuditProcessorService(runs, dao, mock(UrlNormalizer.class), http, html,
                runtime, lighthouse, observatory, ssl, zap, tech, new CheckMergerService(),
                new ScoreEnricherService(policy), new ScoreService(policy), MAPPER, publisher);
            processor.configureRemoteModuleExecutor(remote);
            processor.configureAuditModuleExecutor(local);
            long started = System.nanoTime();
            processor.process(1L);
            long duration = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
            var report = ArgumentCaptor.forClass(AuditReportJson.class);
            verify(publisher).completeAndPublish(eq(1L), eq(audit), report.capture(), anyString(), eq("fixture-claim"));
            verify(runs, never()).fail(anyLong(), anyString(), nullable(String.class));
            return new Sample(report.getValue(), duration);
        }
    }

    private static void assertEquivalent(AuditReportJson baseline, AuditReportJson candidate) throws Exception {
        assertEquals(baseline.modules(), candidate.modules(), "Values, findings and provenance must survive reordering");
        assertEquals(baseline.score(), candidate.score(), "Scores and coverage must be identical");
        assertEquals(baseline.meta().get("moduleStatuses"), candidate.meta().get("moduleStatuses"));
        assertEquals(baseline.meta().get("scopeFingerprint"), candidate.meta().get("scopeFingerprint"));
        assertEquals(baseline.meta().get("scoringFingerprint"), candidate.meta().get("scoringFingerprint"));
        assertTrue(MeasurementContract.completeFingerprint(baseline.meta().get("measurementFingerprint")));
        assertTrue(MeasurementContract.completeFingerprint(candidate.meta().get("measurementFingerprint")));
        assertNotEquals(baseline.meta().get("measurementFingerprint"), candidate.meta().get("measurementFingerprint"),
            "The scheduling change must not silently compare against the historical method");
        assertEquals("ssl-priority-independent-local-v1", MAPPER.readTree(candidate.meta().get("measurementEvidence"))
            .path("configuration").path("remoteScheduling").asText());
        assertTrue(candidate.score().global().maxScore() > 0);
        assertTrue(candidate.score().coverage().checks().stream().anyMatch(c -> c.key().equals("ssl.certificate.expiry_days")
            && c.state() == MeasurementCoverage.State.UNAVAILABLE), "Unknown measurements stay unknown");
    }

    @Test void reorderedCollectionPreservesRealScoresCoverageAndUnknownsIncludingProviderFailure() throws Exception {
        for (boolean unavailable : new boolean[]{false, true}) {
            var baseline = run(1, 0, unavailable).report();
            for (int capacity : new int[]{2, 3}) assertEquivalent(baseline, run(capacity, 0, unavailable).report());
        }
    }

    @Test void controlledLatencyComparisonPreservesTheSameDataInEverySample() throws Exception {
        // Warm class loading first. Delays are a 1:100 model of the observed 118s pipeline,
        // not a Raspberry benchmark. Latch-based tests prove overlap without timing thresholds.
        run(1, 0, false); run(2, 0, false);
        var sequential = new ArrayList<Long>();
        var overlapped = new ArrayList<Long>();
        for (int repetition = 0; repetition < 3; repetition++) {
            var before = run(1, 10, false);
            var after = run(2, 10, false);
            assertEquivalent(before.report(), after.report());
            sequential.add(before.milliseconds()); overlapped.add(after.milliseconds());
            System.out.printf("audit_latency_fixture sample=%d sequentialMs=%d overlappedMs=%d dataEquivalent=true%n",
                repetition + 1, before.milliseconds(), after.milliseconds());
        }
        Collections.sort(sequential); Collections.sort(overlapped);
        System.out.printf("audit_latency_fixture medianSequentialMs=%d medianOverlappedMs=%d%n",
            sequential.get(1), overlapped.get(1));
    }
}
