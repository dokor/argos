package com.dokor.argos.services.analysis;

import com.dokor.argos.services.configuration.ConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CollectorDiagnosticsTest {
    @Test void policyAndUpstreamFailuresRemainDistinctThroughAnalyzerWrappers() {
        assertEquals(CollectorFailure.Code.POLICY_DISABLED,
            CollectorFailure.classify(assertThrows(CollectorFailure.class, () -> RemoteScanPolicy.requireAllowed("example.com", false))));
        for (int status : new int[]{401, 403, 404, 410, 422, 429, 503}) {
            var code = CollectorFailure.classify(new ModuleUnavailableException("private?token=secret",
                new ExternalHttpClient.HttpStatusException(status)));
            assertEquals(switch (status) {
                case 401, 403 -> CollectorFailure.Code.PROVIDER_AUTH_REQUIRED;
                case 404, 410 -> CollectorFailure.Code.INTEGRATION_ENDPOINT;
                case 422 -> CollectorFailure.Code.TARGET_ASSESSMENT_FAILED;
                case 429 -> CollectorFailure.Code.PROVIDER_RATE_LIMITED;
                default -> CollectorFailure.Code.PROVIDER_UNAVAILABLE;
            }, code);
        }
        assertEquals(CollectorFailure.Code.NETWORK_DNS, CollectorFailure.classify(new java.net.UnknownHostException("private")));
        assertEquals(CollectorFailure.Code.NETWORK_CONNECT, CollectorFailure.classify(new java.net.ConnectException("private")));
        assertEquals(CollectorFailure.Code.NETWORK_TLS, CollectorFailure.classify(new javax.net.ssl.SSLException("private")));
        assertEquals(CollectorFailure.Code.DEADLINE_EXCEEDED, CollectorFailure.classify(new java.net.http.HttpTimeoutException("private")));
    }
    @Test void monitoringStartsWithPolicyStateCountsFailuresAndRecoversWithoutRetainingTargets() throws Exception {
        var config = mock(ConfigurationService.class);
        when(config.sslLabsApiUrl()).thenReturn("https://api.ssllabs.com/api/v3");
        when(config.observatoryApiUrl()).thenReturn("https://observatory-api.mdn.mozilla.net/api/v2");
        var monitoring = new CollectorDiagnostics(config);
        assertEquals(2, monitoring.snapshot().size());
            assertTrue(monitoring.snapshot().stream().allMatch(s -> "POLICY_DISABLED".equals(s.failureCode())));
        monitoring.record("ssl", false, new ModuleUnavailableException("https://private.invalid/?token=secret", new ExternalHttpClient.HttpStatusException(429)));
        assertEquals("PROVIDER_RATE_LIMITED", monitoring.snapshot().getFirst().failureCode());
        assertEquals(1, monitoring.snapshot().getFirst().failed());
        monitoring.record("http", false, new IllegalStateException("ignored"));
        monitoring.record("ssl", true, null);
        assertNull(monitoring.snapshot().getFirst().failureCode());
        assertEquals(1, monitoring.snapshot().getFirst().completed());
        assertFalse(new ObjectMapper().writeValueAsString(monitoring.snapshot()).contains("private.invalid"));
        assertEquals(2, monitoring.snapshot().size());
    }
    @Test void enabledMonitoringUsesTheSameConfigurationAsTheClients() {
        var config = mock(ConfigurationService.class);
        when(config.sslLabsApiUrl()).thenReturn("https://api.ssllabs.com/api/v3");
        when(config.observatoryApiUrl()).thenReturn("https://observatory-api.mdn.mozilla.net/api/v2");
        when(config.externalScansEnabled()).thenReturn(true);
        var statuses = new CollectorDiagnostics(config).snapshot();
        assertTrue(statuses.stream().allMatch(s -> s.enabled() && "NOT_OBSERVED".equals(s.state()) && s.failureCode() == null));
    }}
