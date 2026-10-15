package com.dokor.argos.services.analysis.modules.observatory;

import com.dokor.argos.services.analysis.ExternalHttpClient;
import com.dokor.argos.services.configuration.ConfigurationService;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ObservatoryClientTest {
    @Test void removedV1DetailsEndpointIsNeverRequested() throws Exception {
        var transport = mock(ExternalHttpClient.class); var config = mock(ConfigurationService.class);
        when(config.observatoryApiUrl()).thenReturn("https://observatory-api.mdn.mozilla.net/api/v2");
        assertTrue(new ObservatoryClient(transport, config).tests(123).isEmpty());
        verifyNoInteractions(transport);
    }
    @Test void disabledClientNeverContactsTheProvider() throws Exception {
        var transport = mock(ExternalHttpClient.class);
        var config = mock(ConfigurationService.class);
        when(config.observatoryApiUrl()).thenReturn("https://observatory-api.mdn.mozilla.net/api/v2");
        var client = new ObservatoryClient(transport, config);
        assertThrows(com.dokor.argos.services.analysis.CollectorFailure.class, () -> client.scan("example.com"));
        verifyNoInteractions(transport);
    }

    @Test void enabledClientSendsOnlyTheValidatedHostnameAndNoCredentials() throws Exception {
        var transport = mock(ExternalHttpClient.class);
        var config = mock(ConfigurationService.class);
        when(config.externalScansEnabled()).thenReturn(true);
        when(config.observatoryApiUrl()).thenReturn("https://observatory-api.mdn.mozilla.net/api/v2");
        var result = new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"score\":80,\"grade\":\"B+\"}");
        try (var policy = mockStatic(com.dokor.argos.services.analysis.RemoteScanPolicy.class)) {
            policy.when(() -> com.dokor.argos.services.analysis.RemoteScanPolicy.requireAllowed("EXAMPLE.COM", true))
                .thenReturn("example.com");
            when(transport.postJson(any(), isNull(), anyString(), any(), any(), anyLong(), anyMap())).thenReturn(result);
            assertSame(result, new ObservatoryClient(transport, config).scan("EXAMPLE.COM"));
            verify(transport).postJson(java.net.URI.create("https://observatory-api.mdn.mozilla.net/api/v2/scan?host=example.com"),
                null, "application/x-www-form-urlencoded", java.time.Duration.ofSeconds(30),
                java.time.Duration.ofSeconds(15), com.dokor.argos.services.analysis.BoundedBodyHandlers.MAX_PAGE_BYTES,
                java.util.Map.of());
            policy.verify(() -> com.dokor.argos.services.analysis.RemoteScanPolicy.requireAllowed("EXAMPLE.COM", true));
        }
    }

    @Test void enabledClientStillRejectsPrivateAndAmbiguousHostsBeforeTransport() throws Exception {
        var transport = mock(ExternalHttpClient.class);
        var config = mock(ConfigurationService.class);
        when(config.externalScansEnabled()).thenReturn(true);
        when(config.observatoryApiUrl()).thenReturn("https://observatory-api.mdn.mozilla.net/api/v2");
        var client = new ObservatoryClient(transport, config);
        for (String host : new String[]{"localhost", "127.0.0.1", "example.com:443", "example.com?secret=x"}) {
            assertThrows(IllegalArgumentException.class, () -> client.scan(host));
        }
        verifyNoInteractions(transport);
    }}
