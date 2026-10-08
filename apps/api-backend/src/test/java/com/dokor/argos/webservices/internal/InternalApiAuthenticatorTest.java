package com.dokor.argos.webservices.internal;

import com.dokor.argos.services.configuration.ConfigurationService;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.HttpHeaders;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InternalApiAuthenticatorTest {
    private final ConfigurationService configuration = mock(ConfigurationService.class);
    private final ContainerRequestContext request = mock(ContainerRequestContext.class);

    private InternalApiAuthenticator authenticator() {
        when(configuration.internalApiAuthUsername()).thenReturn("monitor");
        when(configuration.internalApiAuthPassword()).thenReturn("synthetic-secret");
        return new InternalApiAuthenticator(configuration);
    }

    private static String basic(String credentials) {
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void missingMalformedAndInvalidHeadersAreUnauthorizedWithoutLeakingCredentials() {
        var auth = authenticator();
        for (String header : new String[] {null, "Bearer token", "Basic !!!", basic("monitor"),
            basic("monitor:wrong-password"), basic("other:synthetic-secret")}) {
            when(request.getHeaderString(HttpHeaders.AUTHORIZATION)).thenReturn(header);
            ClientErrorException error = assertThrows(ClientErrorException.class,
                () -> auth.get().requireAuthentication(request));
            assertEquals(401, error.getResponse().getStatus());
            assertTrue(error.getResponse().getHeaderString(HttpHeaders.WWW_AUTHENTICATE).startsWith("Basic realm="));
            assertFalse(error.getResponse().toString().contains("synthetic-secret"));
        }
    }

    @Test
    void validSecretAuthenticatesWithoutReturningIt() {
        var auth = authenticator();
        when(request.getHeaderString(HttpHeaders.AUTHORIZATION)).thenReturn(basic("monitor:synthetic-secret"));
        assertEquals("Basic user", auth.get().requireAuthentication(request));
    }
}
