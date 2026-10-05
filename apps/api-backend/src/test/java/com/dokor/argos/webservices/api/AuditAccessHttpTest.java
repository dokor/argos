package com.dokor.argos.webservices.api;

import com.dokor.argos.webservices.api.audits.*;
import com.dokor.argos.webservices.api.audits.data.CreateAuditResponse;
import com.dokor.argos.webservices.api.report.ReportsWs;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.dokor.argos.db.generated.AuditRun;
import com.coreoz.plume.jersey.errors.WsJacksonJsonProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.grizzly.http.server.HttpServer;
import org.glassfish.grizzly.threadpool.ThreadPoolConfig;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Exercises the actual Jersey routes over HTTP, including direct-backend bypass. */
class AuditAccessHttpTest {
    private static HttpServer server;
    private static String base;
    private static final AuditService AUDITS = mock(AuditService.class);
    private static final AuditRunService RUNS = mock(AuditRunService.class);
    private static final HttpClient CLIENT = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(java.time.Duration.ofSeconds(5)).build();
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    @BeforeAll static void start() throws Exception {
        var settings = mock(ConfigurationService.class);
        when(settings.adminApiToken()).thenReturn("synthetic-server-credential");
        var json = new WsJacksonJsonProvider(); json.setMapper(MAPPER);
        var config = new ResourceConfig().register(json)
            .register(new AuditsWs(AUDITS, new AdminReadAccess(settings), mock(ReportReadService.class)))
            .register(new ReportsWs(mock(ReportReadService.class), RUNS));
        server = GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/"), config, false);
        for (var listener : server.getListeners()) {
            listener.getTransport().setSelectorRunnersCount(1);
            listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4));
        }
        server.start(); base = "http://127.0.0.1:" + server.getListeners().iterator().next().getPort();
    }
    @AfterAll static void stop() { if (server != null) server.shutdownNow(); }
    @BeforeEach void resetMocks() { reset(AUDITS, RUNS); }
    private HttpResponse<String> get(String path, String header, String value) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base + path)).timeout(java.time.Duration.ofSeconds(10));
        if (header != null) request.header(header, value);
        return CLIENT.send(request.GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    @ParameterizedTest @ValueSource(strings = {"/audits", "/audits/1/history", "/audits/runs/1", "/audits/runs/1/report"})
    void privateRoutesRejectAbsentInvalidCookieAndBearer(String path) throws Exception {
        assertEquals(401, get(path, null, null).statusCode());
        assertEquals(401, get(path, "Cookie", "argos_admin=synthetic-server-credential").statusCode());
        assertEquals(401, get(path, "Authorization", "Bearer guessed").statusCode());
        verifyNoInteractions(AUDITS);
    }
    @Test void validServerCredentialAllowsAdminListAndHistory() throws Exception {
        when(AUDITS.listAudits(50)).thenReturn(List.of());
        when(AUDITS.getAuditHistory(1,20)).thenReturn(List.of());
        assertEquals(200, get("/audits", "Authorization", "Bearer synthetic-server-credential").statusCode());
        assertEquals(200, get("/audits/1/history", "Authorization", "Bearer synthetic-server-credential").statusCode());
        verify(AUDITS).listAudits(50); verify(AUDITS).getAuditHistory(1,20);
    }
    @Test void publicCreationDoesNotNeedAdminCredential() throws Exception {
        when(AUDITS.createAudit(any())).thenReturn(new CreateAuditResponse(1L,2L,"QUEUED",Instant.EPOCH,"synthetic-new-token"));
        var request = HttpRequest.newBuilder(URI.create(base + "/audits")).timeout(java.time.Duration.ofSeconds(10)).header("Content-Type","application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"url\":\"https://example.com\"}")).build();
        var response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode()); assertTrue(response.body().contains("synthetic-new-token"));
    }
    @Test void unknownTokenIs404AndKnownProgressNeverEchoesCredentialsOrInternals() throws Exception {
        when(RUNS.findByReportToken("unknown")).thenReturn(Optional.empty());
        assertEquals(404,get("/reports/unknown/status",null,null).statusCode());
        var run = new AuditRun(); run.setId(1L); run.setAuditId(2L); run.setStatus("RUNNING");
        run.setReportTokenHash(new byte[32]); run.setResultJson("private-result"); run.setLastError("private-error");
        run.setModuleStatuses("[]");
        when(RUNS.findByReportToken("known")).thenReturn(Optional.of(run));
        var response = get("/reports/known/status",null,null);
        assertEquals(200,response.statusCode());
        var data = MAPPER.readTree(response.body());
        assertEquals("RUNNING",data.path("status").asText());
        for (String field : List.of("runId","auditId","reportToken","resultJson","lastError","inputUrl")) assertFalse(data.has(field));
        assertFalse(response.body().contains("private-"));
        assertTrue(response.headers().firstValue("Cache-Control").orElseThrow().contains("no-store"));
    }
    @Test void missingServerCredentialNeverAllowsReads() {
        var settings = mock(ConfigurationService.class);
        var access = new AdminReadAccess(settings);
        assertThrows(jakarta.ws.rs.NotAuthorizedException.class, () -> access.require("Bearer any"));
    }
}
