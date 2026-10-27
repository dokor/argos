package com.dokor.argos.services.ci;

import com.dokor.argos.services.ci.errors.CiErrorCode;
import com.dokor.argos.webservices.api.account.CiKeyFilter;
import com.dokor.argos.webservices.api.account.CiResponseBoundary;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CiKeyFilterTest {
    @Test void authenticatedChunkedBodiesAreBoundedAndTrafficIsChargedBeforeParsing() throws Exception {
        var keys=mock(CiKeysService.class);var rates=mock(CiRateService.class);
        var identity=new CiKeysService.Context(10,20,"integration","key",java.util.Set.of(),List.of());
        when(keys.enabled()).thenReturn(true);
        when(keys.<CiKeysService.Context>withCredential(any(),any(),any(),any())).thenReturn(identity);
        var request=mock(ContainerRequestContext.class);var uri=mock(UriInfo.class);
        when(request.getUriInfo()).thenReturn(uri);when(uri.getPath()).thenReturn("ci/v1/analyses");
        when(request.getMethod()).thenReturn("POST");when(request.hasEntity()).thenReturn(true);
        when(request.getLength()).thenReturn(-1);
        when(request.getEntityStream()).thenReturn(new java.io.ByteArrayInputStream(new byte[8193]));
        new CiKeyFilter(keys,rates).filter(request);
        verify(rates).ingress("direct");verify(rates).traffic(identity,true);
        var bounded=org.mockito.ArgumentCaptor.forClass(java.io.InputStream.class);
        verify(request).setEntityStream(bounded.capture());
        assertThrows(java.io.IOException.class,()->bounded.getValue().readAllBytes());
    }
    @Test void matrixParametersCannotBypassMachineNamespaceAuthentication() {
        var keys=mock(CiKeysService.class);
        when(keys.withCredential(isNull(),eq("direct"),isNull(),any()))
            .thenThrow(CiAccountOperations.fail(CiErrorCode.AUTHENTICATION_FAILED));
        var filter=new CiKeyFilter(keys);
        for(var path:List.of("ci","/ci/","ci/v1/identity","ci;ignored=1/v1/identity",
                "/ci;ignored=1/v1;anything/missing/","ci;ignored=1")) {
            var request=mock(ContainerRequestContext.class);var uri=mock(UriInfo.class);
            when(request.getUriInfo()).thenReturn(uri);when(uri.getPath()).thenReturn(path);
            filter.filter(request);
            verify(request).abortWith(argThat(response->response.getStatus()==401));
            assertTrue(CiResponseBoundary.applies(path),path);
        }
        verify(keys,times(6)).withCredential(isNull(),eq("direct"),isNull(),any());
    }

    @Test void accountManagementKeepsItsBrowserSessionGate() {
        var keys=mock(CiKeysService.class);var request=mock(ContainerRequestContext.class);var uri=mock(UriInfo.class);
        when(request.getUriInfo()).thenReturn(uri);when(uri.getPath()).thenReturn("account;ignored=1/ci;anything/keys");
        new CiKeyFilter(keys).filter(request);
        verifyNoInteractions(keys);verify(request,never()).abortWith(any());
        assertTrue(CiResponseBoundary.applies("account;ignored=1/ci;anything/keys"));
        assertFalse(CiResponseBoundary.applies("cicada/v1/identity"));
    }
}
