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

    private static AuditStatus consoleErrorsStatus(int consoleErrors) throws Exception {
        PlaywrightRuntimeClient client = mock(PlaywrightRuntimeClient.class);
        when(client.analyzeRuntime(anyString())).thenReturn(response(consoleErrors));

        AuditModuleResult res = new RuntimeModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        return res.checks().stream()
            .filter(c -> "runtime.console.errors".equals(c.key()))
            .map(AuditCheckResult::status)
            .findFirst().orElseThrow();
    }

    private static PlaywrightRuntimeClient.RuntimeAnalyzeResponse response(int consoleErrors) {
        return new PlaywrightRuntimeClient.RuntimeAnalyzeResponse(
            "https://example.com",
            "https://example.com",
            new PlaywrightRuntimeClient.Timings(100L, 200L),
            new PlaywrightRuntimeClient.Console(consoleErrors, 0, List.of()),
            new PlaywrightRuntimeClient.JsErrors(0, List.of()),
            new PlaywrightRuntimeClient.Network(10, 0, 0, 0, 1_000L, Map.of(), List.of())
        );
    }
}
