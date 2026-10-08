package com.dokor.argos.services.analysis.modules.runtime;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.ModuleUnavailableException;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.modules.runtime.PlaywrightRuntimeClient;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.net.http.HttpTimeoutException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RuntimeModuleAnalyzerTest {

    private static AuditContext ctx() {
        return new AuditContext("http://example.com", "http://example.com", 1L);
    }

    @Test
    void marksTimeoutWhenClientTimesOut() throws Exception {
        PlaywrightRuntimeClient client = mock(PlaywrightRuntimeClient.class);
        when(client.analyzeRuntime(anyString())).thenThrow(new HttpTimeoutException("request timed out"));

        var error = assertThrows(ModuleUnavailableException.class,
            () -> new RuntimeModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test")));
        assertInstanceOf(HttpTimeoutException.class, error.getCause());
    }

    @Test
    void marksFailedOnGenericError() throws Exception {
        PlaywrightRuntimeClient client = mock(PlaywrightRuntimeClient.class);
        when(client.analyzeRuntime(anyString())).thenThrow(new IllegalStateException("service 500"));

        assertThrows(ModuleUnavailableException.class,
            () -> new RuntimeModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test")));
    }

    @Test
    void emptyResponseCannotBecomeZeroErrorSuccess() {
        var empty = new PlaywrightRuntimeClient.RuntimeAnalyzeResponse(
            "https://example.com", "https://example.com", null, null, null, null);
        assertThrows(ModuleUnavailableException.class, () -> analyze(empty));
    }

    @Test
    void partialResponseKeepsOnlyMeasuredChecks() throws Exception {
        var partial = new PlaywrightRuntimeClient.RuntimeAnalyzeResponse(
            "https://example.com", "https://example.com", null,
            new PlaywrightRuntimeClient.Console(2, 0, List.of(), null), null, null);
        var result = analyze(partial);
        assertEquals(Boolean.TRUE, result.data().get("partial"));
        assertEquals(AuditStatus.WARN, checkStatus(result, "runtime.console.errors"));
        assertEquals(0, result.checks().stream()
            .filter(c -> c.key().equals("runtime.js.errors") || c.key().equals("runtime.network.5xx"))
            .count());
    }

    @Test
    void missingTimingsPreserveMeasuredNetworkDefectsAndScoring() throws Exception {
        var full = response(2, 1, 2, 1, 2, 1, 0, 0);
        var result = analyze(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse(full.url(), full.finalUrl(),
            new PlaywrightRuntimeClient.Timings(null, null), full.console(), full.jsErrors(), full.network(),
            new PlaywrightRuntimeClient.Navigation("FAILED", "NAVIGATION_ERROR")));
        assertEquals(true, result.data().get("partial"));
        assertEquals("FAILED", ((Map<?, ?>) result.data().get("navigation")).get("status"));
        assertNull(((Map<?, ?>) result.data().get("timings")).get("loadMs"));
        assertEquals(AuditStatus.FAIL, checkStatus(result, "runtime.network.5xx"));
        assertEquals(2, checkValue(result, "runtime.network.failed_requests"));
        var policy = new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy();
        var modules = new com.dokor.argos.services.analysis.scoring.ScoreEnricherService(policy).enrich(List.of(result));
        var failed = modules.getFirst().checks().stream().filter(c -> c.key().equals("runtime.network.5xx")).findFirst().orElseThrow();
        assertTrue(failed.scorable());
        assertTrue(failed.weight() > 0);
        var coverage = com.dokor.argos.services.analysis.scoring.MeasurementCoverageService.compute(policy, modules);
        assertEquals(com.dokor.argos.services.analysis.scoring.MeasurementCoverage.State.MEASURED,
            coverage.checks().stream().filter(c -> c.key().equals("runtime.network.5xx")).findFirst().orElseThrow().state());
    }

    @Test
    void singleMissingTimingRemainsNullAndMarksPartial() throws Exception {
        var full = response(0);
        var result = analyze(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse(full.url(), full.finalUrl(),
            new PlaywrightRuntimeClient.Timings(100L, null), full.console(), full.jsErrors(), full.network()));
        assertEquals(true, result.data().get("partial"));
        var timings = (Map<?, ?>) result.data().get("timings");
        assertEquals(100L, timings.get("domContentLoadedMs"));
        assertNull(timings.get("loadMs"));
        assertEquals("UNKNOWN", ((Map<?, ?>) result.data().get("navigation")).get("status"));
    }

    @Test
    void absentNetworkAndCountersStayUnknownInData() throws Exception {
        var result = analyze(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse("https://example.com", "https://example.com",
            null, new PlaywrightRuntimeClient.Console(null, null, List.of(), null),
            new PlaywrightRuntimeClient.JsErrors(0, List.of()), null));
        assertNull(result.data().get("network"));
        var console = (Map<?, ?>) result.data().get("console");
        assertNull(console.get("errors"));
        assertNull(console.get("errorsFirstParty"));
        assertNull(console.get("warnings"));
        assertEquals(0, ((Map<?, ?>) result.data().get("jsErrors")).get("count"));
        assertEquals(AuditStatus.PASS, checkStatus(result, "runtime.js.errors"));
        assertFalse(result.checks().stream().anyMatch(c -> c.key().equals("runtime.console.errors") || c.key().startsWith("runtime.network.")));
    }

    @Test
    void absentByTypeAndPartialSamplesDoNotDiscardCounters() throws Exception {
        var samples = java.util.Arrays.asList(null, new PlaywrightRuntimeClient.ConsoleSample("error", "failure", null),
            new PlaywrightRuntimeClient.ConsoleSample("error", null, null));
        var result = analyze(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse("https://example.com", "https://example.com",
            null, new PlaywrightRuntimeClient.Console(2, null, samples, null),
            new PlaywrightRuntimeClient.JsErrors(1, java.util.Arrays.asList(null, new PlaywrightRuntimeClient.JsErrorSample(null))),
            new PlaywrightRuntimeClient.Network(3, 1, null, 0, null, null, null, null, null, null, null)));
        assertEquals(true, result.data().get("partial"));
        var network = (Map<?, ?>) result.data().get("network");
        assertNull(network.get("byType"));
        assertNull(network.get("totalBytesEstimated"));
        assertEquals(1, network.get("failedRequests"));
        assertEquals(AuditStatus.WARN, checkStatus(result, "runtime.network.failed_requests"));
        assertEquals(3, checkValue(result, "runtime.network.request_count"));
        var console = result.checks().stream().filter(c -> c.key().equals("runtime.console.errors")).findFirst().orElseThrow();
        assertEquals(List.of(Map.of("type", "error", "text", "failure"), Map.of("type", "error")), console.details().get("samples"));
    }

    @Test
    void explicitFirstPartyCounterIsMeasuredEvenWhenAggregateIsUnknown() throws Exception {
        var result = analyze(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse("https://example.com", "https://example.com",
            null, null, null, new PlaywrightRuntimeClient.Network(null, null, null, null, null, null, null, 2, null, 1, null)));
        assertEquals(2, checkValue(result, "runtime.network.failed_requests"));
        assertEquals(AuditStatus.FAIL, checkStatus(result, "runtime.network.5xx"));
        var network = (Map<?, ?>) result.data().get("network");
        assertNull(network.get("failedRequests"));
        assertNull(network.get("failedRequestsThirdParty"));
        assertFalse(result.checks().stream().anyMatch(c -> c.key().equals("runtime.network.third_party_errors")));
    }

    @Test
    void timingOnlyAndSampleOnlyResponsesPreserveAvailableObservations() throws Exception {
        var timing = analyze(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse("https://example.com", "https://example.com",
            new PlaywrightRuntimeClient.Timings(0L, null), null, null, null));
        assertEquals(0L, ((Map<?, ?>) timing.data().get("timings")).get("domContentLoadedMs"));
        assertEquals(1, timing.checks().size()); // Only worker duration; no invented error counts.
        var sample = new PlaywrightRuntimeClient.ConsoleSample("error", "observed failure", null);
        var result = analyze(new PlaywrightRuntimeClient.RuntimeAnalyzeResponse("https://example.com", "https://example.com",
            null, new PlaywrightRuntimeClient.Console(null, null, List.of(sample), null), null, null));
        assertEquals(List.of(sample), ((Map<?, ?>) result.data().get("console")).get("samples"));
        assertEquals(1, result.checks().size());
    }

    // -------------------------
    // Seuils des erreurs console (issue #100) : 0 => PASS, 1..10 => WARN, > 10 => FAIL
    // -------------------------

    @Test
    void consoleErrors_zeroIsPass() throws Exception {
        assertEquals(AuditStatus.PASS, consoleErrorsStatus(0));
    }

    @Test
    void consoleErrors_fewAreWarnNotFail() throws Exception {
        // 5 erreurs (typiques de scripts tiers) => WARN, plus FAIL (comportement avant #100).
        assertEquals(AuditStatus.WARN, consoleErrorsStatus(5));
    }

    @Test
    void consoleErrors_atThresholdIsWarn() throws Exception {
        assertEquals(AuditStatus.WARN, consoleErrorsStatus(RuntimeModuleAnalyzer.CONSOLE_ERRORS_WARN_MAX));
    }

    @Test
    void consoleErrors_aboveThresholdIsFail() throws Exception {
        assertEquals(AuditStatus.FAIL, consoleErrorsStatus(RuntimeModuleAnalyzer.CONSOLE_ERRORS_WARN_MAX + 1));
    }

    // Distinction première partie / tiers (issue #153) : le statut se fonde sur les
    // erreurs du site, pas sur le bruit des scripts tiers.
    @Test
    void consoleErrors_thirdPartyNoiseIgnored() throws Exception {
        // 20 erreurs au total mais 0 de première partie => PASS (bruit tiers ignoré).
        assertEquals(AuditStatus.PASS, consoleErrorsStatus(20, 0));
    }

    @Test
    void consoleErrors_firstPartyDrivesStatus() throws Exception {
        // 20 au total, 15 de première partie => FAIL (> seuil), le tiers n'y change rien.
        assertEquals(AuditStatus.FAIL, consoleErrorsStatus(20, 15));
        // 20 au total, 3 de première partie => WARN.
        assertEquals(AuditStatus.WARN, consoleErrorsStatus(20, 3));
    }

    @Test
    void networkErrors_thirdPartyOnlyDoNotAffectScore() throws Exception {
        AuditModuleResult result = analyze(response(0, -1, 2, 3, 0, 0, 2, 3));

        assertEquals(AuditStatus.PASS, checkStatus(result, "runtime.network.5xx"));
        assertEquals(AuditStatus.PASS, checkStatus(result, "runtime.network.failed_requests"));
        assertEquals(AuditStatus.WARN, checkStatus(result, "runtime.network.third_party_errors"));
        assertEquals(5, checkValue(result, "runtime.network.third_party_errors"));
    }

    @Test
    void networkErrors_firstPartyAndMixedErrorsDriveOnlyFirstPartyChecks() throws Exception {
        AuditModuleResult result = analyze(response(0, -1, 3, 2, 1, 2, 2, 0));

        assertEquals(AuditStatus.FAIL, checkStatus(result, "runtime.network.5xx"));
        assertEquals(AuditStatus.WARN, checkStatus(result, "runtime.network.failed_requests"));
        assertEquals(2, checkValue(result, "runtime.network.5xx"));
        assertEquals(1, checkValue(result, "runtime.network.failed_requests"));
        assertEquals(2, checkValue(result, "runtime.network.third_party_errors"));
    }

    @Test
    void networkErrors_legacyProducerFallsBackToAggregateCounters() throws Exception {
        AuditModuleResult result = analyze(response(0, -1, 1, 1, null, null, null, null));

        assertEquals(AuditStatus.FAIL, checkStatus(result, "runtime.network.5xx"));
        assertEquals(AuditStatus.WARN, checkStatus(result, "runtime.network.failed_requests"));
    }

    private static AuditStatus consoleErrorsStatus(int consoleErrors) throws Exception {
        return consoleErrorsStatusOf(response(consoleErrors));
    }

    private static AuditStatus consoleErrorsStatus(int consoleErrors, int firstParty) throws Exception {
        return consoleErrorsStatusOf(response(consoleErrors, firstParty));
    }

    private static AuditStatus consoleErrorsStatusOf(PlaywrightRuntimeClient.RuntimeAnalyzeResponse resp) throws Exception {
        return checkStatus(analyze(resp), "runtime.console.errors");
    }

    private static AuditModuleResult analyze(PlaywrightRuntimeClient.RuntimeAnalyzeResponse resp) throws Exception {
        PlaywrightRuntimeClient client = mock(PlaywrightRuntimeClient.class);
        when(client.analyzeRuntime(anyString())).thenReturn(resp);
        return new RuntimeModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
    }

    private static AuditStatus checkStatus(AuditModuleResult result, String key) {
        return result.checks().stream()
            .filter(c -> key.equals(c.key()))
            .map(AuditCheckResult::status)
            .findFirst().orElseThrow();
    }

    private static Object checkValue(AuditModuleResult result, String key) {
        return result.checks().stream()
            .filter(c -> key.equals(c.key()))
            .map(AuditCheckResult::value)
            .findFirst().orElseThrow();
    }

    private static PlaywrightRuntimeClient.RuntimeAnalyzeResponse response(int consoleErrors) {
        // errorsFirstParty = null => repli sur le total (comportement historique).
        return response(consoleErrors, -1);
    }

    private static PlaywrightRuntimeClient.RuntimeAnalyzeResponse response(int consoleErrors, int firstParty) {
        return response(consoleErrors, firstParty, 0, 0, 0, 0, 0, 0);
    }

    private static PlaywrightRuntimeClient.RuntimeAnalyzeResponse response(
        int consoleErrors, int firstParty, int failedRequests, int status5xx,
        Integer failedRequestsFirstParty, Integer status5xxFirstParty,
        Integer failedRequestsThirdParty, Integer status5xxThirdParty
    ) {
        return new PlaywrightRuntimeClient.RuntimeAnalyzeResponse(
            "https://example.com",
            "https://example.com",
            new PlaywrightRuntimeClient.Timings(100L, 200L),
            new PlaywrightRuntimeClient.Console(consoleErrors, 0, List.of(), firstParty < 0 ? null : firstParty),
            new PlaywrightRuntimeClient.JsErrors(0, List.of()),
            new PlaywrightRuntimeClient.Network(
                10, failedRequests, 0, status5xx, 1_000L, Map.of(), List.of(),
                failedRequestsFirstParty, failedRequestsThirdParty, status5xxFirstParty, status5xxThirdParty)
        );
    }
}
