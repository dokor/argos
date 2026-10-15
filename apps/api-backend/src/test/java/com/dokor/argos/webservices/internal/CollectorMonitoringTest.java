package com.dokor.argos.webservices.internal;

import com.coreoz.plume.jersey.security.basic.BasicAuthenticator;
import com.dokor.argos.services.analysis.CollectorDiagnostics;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.container.ContainerRequestContext;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CollectorMonitoringTest {
    @Test void collectorMonitoringRequiresTheExistingInternalAuthenticationBeforeReading() throws Exception {
        var endpoint = mock(MonitoringWs.class, CALLS_REAL_METHODS);
        var auth = mock(BasicAuthenticator.class);
        var diagnostics = mock(CollectorDiagnostics.class);
        var request = mock(ContainerRequestContext.class);
        var authField = MonitoringWs.class.getDeclaredField("basicAuthenticator"); authField.setAccessible(true); authField.set(endpoint, auth);
        var dataField = MonitoringWs.class.getDeclaredField("collectorDiagnostics"); dataField.setAccessible(true); dataField.set(endpoint, diagnostics);
        doThrow(new NotAuthorizedException("Internal authentication required")).when(auth).requireAuthentication(request);
        assertThrows(NotAuthorizedException.class, () -> endpoint.collectors(request));
        verifyNoInteractions(diagnostics);
        doReturn(null).when(auth).requireAuthentication(request);
        when(diagnostics.snapshot()).thenReturn(java.util.List.of());
        assertTrue(endpoint.collectors(request).isEmpty());
        verify(diagnostics).snapshot();
    }
}
