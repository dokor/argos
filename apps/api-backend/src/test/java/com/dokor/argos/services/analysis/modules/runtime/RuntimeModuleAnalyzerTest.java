package com.dokor.argos.services.analysis.modules.runtime;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.playwright.PlaywrightRuntimeClient;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.net.http.HttpTimeoutException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class RuntimeModuleAnalyzerTest {

    private static AuditContext ctx() {
        return new AuditContext("http://example.com", "http://example.com", 1L);
    }

    @Test
    void marksTimeoutWhenClientTimesOut() throws Exception {
        PlaywrightRuntimeClient client = mock(PlaywrightRuntimeClient.class);
        when(client.analyzeRuntime(anyString())).thenThrow(new HttpTimeoutException("request timed out"));

        AuditModuleResult res = new RuntimeModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("TIMEOUT", res.data().get("reason"));
        assertEquals(1, res.checks().size());
        assertEquals(AuditStatus.WARN, res.checks().get(0).status());
    }

    @Test
    void marksFailedOnGenericError() throws Exception {
        PlaywrightRuntimeClient client = mock(PlaywrightRuntimeClient.class);
        when(client.analyzeRuntime(anyString())).thenThrow(new IllegalStateException("service 500"));

        AuditModuleResult res = new RuntimeModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("FAILED", res.data().get("reason"));
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
