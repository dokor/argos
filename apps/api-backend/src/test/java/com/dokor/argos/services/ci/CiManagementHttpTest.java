package com.dokor.argos.services.ci;
import com.coreoz.plume.jersey.security.permission.*;
import com.dokor.argos.jersey.SafeJsonProvider;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.webservices.api.account.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.ConfigFactory;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.List;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.grizzly.threadpool.ThreadPoolConfig;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CiManagementHttpTest {
    @Test void csrfFailureIsVersionedBeforeKeyManagementIsCalled() throws Exception {
        var keys=mock(CiKeysService.class);var permissions=mock(AccountPermissionProvider.class);
        when(permissions.correspondingPermissions(any())).thenReturn(List.of("session","verified"));
        var mapper=new ObjectMapper();var json=new SafeJsonProvider();json.setMapper(mapper);
        var config=new ResourceConfig().register(json).register(new CiKeysWs(keys,new AccountCsrf(new AccountSettings(ConfigFactory.empty()))))
            .register(new CiResponseBoundary()).register(RequireExplicitAccessControlFeature.accessControlAnnotations(PublicApi.class,AccountAccess.class))
            .register(new PermissionFeature<>(permissions,AccountAccess.class,AccountAccess::value));
        var server=GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/"),config,false);
        for(var listener:server.getListeners()){listener.getTransport().setSelectorRunnersCount(1);listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4));}
        server.start();
        try {
            var uri=URI.create("http://127.0.0.1:"+server.getListeners().iterator().next().getPort()+"/account/ci/keys");
            var client=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
            var response=client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5)).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"fixture\",\"scopes\":[\"usage:read\"],\"targetIds\":[]}")).build(),HttpResponse.BodyHandlers.ofString());
            assertEquals(403,response.statusCode());
            assertEquals("REQUEST_REJECTED",mapper.readTree(response.body()).path("error").path("code").asText());
            verifyNoInteractions(keys);
        }finally{server.shutdownNow();}
    }
    @Test void databaseUnavailableIsNotMisreportedAsAMissingScope() {
        var error=assertThrows(jakarta.ws.rs.WebApplicationException.class,()->CiAccountOperations.boundary(()->{throw new AccountError(503,"account_unavailable");}));
        assertEquals(CiErrorCode.UPSTREAM_UNAVAILABLE,((CiErrors.Envelope)error.getResponse().getEntity()).error().code());
    }
}
