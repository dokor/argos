package com.dokor.argos.webservices.api;

import com.dokor.argos.webservices.api.audits.*;
import com.dokor.argos.webservices.api.report.ReportsWs;
import com.dokor.argos.webservices.api.newsletter.NewsletterWs;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.audit.errors.NotFoundException;
import com.dokor.argos.services.domain.newsletter.NewsletterService;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.dokor.argos.services.domain.report.ReportDto;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.Domain;
import com.dokor.argos.db.dao.AuditDao;
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
    private static final AuditQueryService QUERIES = mock(AuditQueryService.class);
    private static final AuditRunService RUNS = mock(AuditRunService.class);
    private static final ReportReadService READS = mock(ReportReadService.class);
    private static final NewsletterService NEWSLETTER = mock(NewsletterService.class);
    private static final HttpClient CLIENT = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(java.time.Duration.ofSeconds(5)).build();
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    @BeforeAll static void start() throws Exception {
        var settings = mock(ConfigurationService.class);
        when(settings.adminApiToken()).thenReturn("synthetic-server-credential");
        var json = new WsJacksonJsonProvider(); json.setMapper(MAPPER);
        var config = new ResourceConfig().register(json)
            .register(new AuditsWs(AUDITS, QUERIES, new AdminReadAccess(settings), READS))
            .register(new ReportsWs(READS, RUNS))
            .register(new NewsletterWs(NEWSLETTER));
        server = GrizzlyHttpServerFactory.createHttpServer(URI.create("http://127.0.0.1:0/"), config, false);
        for (var listener : server.getListeners()) {
            listener.getTransport().setSelectorRunnersCount(1);
            listener.getTransport().setWorkerThreadPoolConfig(ThreadPoolConfig.defaultConfig().setCorePoolSize(2).setMaxPoolSize(4));
        }
        server.start(); base = "http://127.0.0.1:" + server.getListeners().iterator().next().getPort();
    }
    @AfterAll static void stop() { if (server != null) server.shutdownNow(); }
    @BeforeEach void resetMocks() { reset(AUDITS, QUERIES, RUNS, READS, NEWSLETTER); }
    private HttpResponse<String> get(String path, String header, String value) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base + path)).timeout(java.time.Duration.ofSeconds(10));
        if (header != null) request.header(header, value);
        return CLIENT.send(request.GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    private HttpResponse<String> post(String path, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(base + path)).timeout(java.time.Duration.ofSeconds(10))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        return CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    }
    @ParameterizedTest @ValueSource(strings = {"/audits", "/audits/1/history", "/audits/1/history/1/comparison", "/audits/runs/1", "/audits/runs/1/report"})
    void privateRoutesRejectAbsentInvalidCookieAndBearer(String path) throws Exception {
        assertEquals(401, get(path, null, null).statusCode());
        assertEquals(401, get(path, "Cookie", "argos_admin=synthetic-server-credential").statusCode());
        assertEquals(401, get(path, "Authorization", "Bearer guessed").statusCode());
        verifyNoInteractions(AUDITS);
        verifyNoInteractions(QUERIES);
    }
    @Test void validServerCredentialAllowsAdminListAndHistory() throws Exception {
        when(QUERIES.listAudits(50)).thenReturn(List.of());
        when(QUERIES.getAuditHistory(1,20)).thenReturn(List.of());
        assertEquals(200, get("/audits", "Authorization", "Bearer synthetic-server-credential").statusCode());
        assertEquals(200, get("/audits/1/history", "Authorization", "Bearer synthetic-server-credential").statusCode());
        verify(QUERIES).listAudits(50); verify(QUERIES).getAuditHistory(1,20);
    }
    @Test void publicCreationDoesNotNeedAdminCredential() throws Exception {
        when(AUDITS.createAudit(anyString())).thenReturn(
            new AuditService.CreatedAudit(1L,2L,"QUEUED",Instant.EPOCH,"synthetic-new-token"));
        var request = HttpRequest.newBuilder(URI.create(base + "/audits")).timeout(java.time.Duration.ofSeconds(10)).header("Content-Type","application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"url\":\"https://example.com\"}")).build();
        var response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200,response.statusCode()); assertTrue(response.body().contains("synthetic-new-token"));
    }
    @Test void adminRepresentationsKeepFieldsAndPaginationBounds() throws Exception {
        Audit audit = new Audit();
        audit.setId(7L); audit.setInputUrl("https://example.com");
        audit.setNormalizedUrl("https://example.com/"); audit.setCreatedAt(Instant.EPOCH);
        Domain domain = new Domain(); domain.setHostname("example.com");
        AuditRun run = new AuditRun();
        run.setId(42L); run.setAuditId(7L); run.setStatus("COMPLETED");
        run.setCreatedAt(Instant.EPOCH); run.setResultJson("{}");
        when(QUERIES.listAudits(200)).thenReturn(List.of(new AuditQueryService.Overview(
            new AuditDao.OverviewRow(7, "example.com", audit.getInputUrl(), audit.getNormalizedUrl(),
                Instant.EPOCH, 42L, "COMPLETED", Instant.EPOCH, null, true, 68))));
        when(QUERIES.getAuditHistory(7, 1)).thenReturn(List.of(new AuditQueryService.History(
            new AuditDao.HistoryRow(42, "COMPLETED", Instant.EPOCH, null, true, 68))));
        when(QUERIES.getRunStatus(42)).thenReturn(run);
        when(QUERIES.getComparisonDetail(7, 42)).thenReturn(new AuditQueryService.ComparisonDetail(
            null, null, new com.dokor.argos.services.domain.report.AuditComparisonService.Comparison(
                com.dokor.argos.services.domain.report.AuditComparisonService.Reason.NO_PREVIOUS_REPORT,
                null, List.of(), List.of(), false)));
        String authorization = "Bearer synthetic-server-credential";

        var list = get("/audits?limit=999", "Authorization", authorization);
        assertEquals(200, list.statusCode());
        assertEquals("42", MAPPER.readTree(list.body()).get(0).path("runId").asText());
        assertEquals("/dashboard/report/42",
            MAPPER.readTree(list.body()).get(0).path("reportUrl").asText());
        var listItem = MAPPER.readTree(list.body()).get(0);
        assertEquals(68, listItem.path("globalScore").asInt());
        for (String field : List.of("resultJson", "reportJson", "reportToken", "tokenHash", "claimToken"))
            assertFalse(listItem.has(field));
        assertTrue(list.headers().firstValue("Cache-Control").orElseThrow().contains("no-store"));
        var history = get("/audits/7/history?limit=0", "Authorization", authorization);
        assertEquals(68, MAPPER.readTree(history.body()).get(0).path("globalScore").asInt());
        assertFalse(MAPPER.readTree(history.body()).get(0).has("reportJson"));
        var comparison = get("/audits/7/history/42/comparison", "Authorization", authorization);
        assertEquals("NO_PREVIOUS_REPORT", MAPPER.readTree(comparison.body()).path("comparison").path("reason").asText());
        assertEquals(200, get("/audits/runs/42", "Authorization", authorization).statusCode());
        verify(QUERIES).listAudits(200);
        verify(QUERIES).getAuditHistory(7, 1);
        verify(QUERIES).getComparisonDetail(7, 42);
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

    @Test void creationRejectsMissingAndInvalidUrlWithoutQueuing() throws Exception {
        assertEquals(400, post("/audits", "{}").statusCode());
        assertEquals(400, post("/audits", "{\"url\":\"  \"}").statusCode());
        verifyNoInteractions(AUDITS);

        when(AUDITS.createAudit("file:///etc/passwd")).thenThrow(new IllegalArgumentException("Unsupported URL scheme"));
        var invalid = post("/audits", "{\"url\":\"file:///etc/passwd\"}");
        assertEquals(400, invalid.statusCode());
        assertEquals("Unsupported URL scheme", MAPPER.readTree(invalid.body()).path("error").asText());
    }

    @Test void missingRunAndReportReturn404AndPublishedReportIsPrivate() throws Exception {
        when(QUERIES.getRunStatus(999)).thenThrow(new NotFoundException("missing"));
        assertEquals(404, get("/audits/runs/999", "Authorization", "Bearer synthetic-server-credential").statusCode());
        assertEquals(404, get("/reports/unknown", null, null).statusCode());
        ReportDto report = new ReportDto("now", "example.com", "https://example.com",
            new ReportDto.Site("Example", null), null, null, List.of(), null, null);
        when(READS.getByToken("known")).thenReturn(Optional.of(report));
        var found = get("/reports/known", null, null);
        assertEquals(200, found.statusCode());
        assertEquals("Example", MAPPER.readTree(found.body()).path("site").path("title").asText());
        assertEquals("noindex, nofollow", found.headers().firstValue("X-Robots-Tag").orElseThrow());
        assertTrue(found.headers().firstValue("Cache-Control").orElseThrow().contains("no-store"));
    }

    @Test void expiredProgressIs404AndBackendFailureIsNotReportedAsSuccess() throws Exception {
        var run = new AuditRun();
        run.setId(10L);
        when(RUNS.findByReportToken("expired")).thenReturn(Optional.of(run));
        when(READS.isExpired(10L)).thenReturn(true);
        assertEquals(404, get("/reports/expired/status", null, null).statusCode());

        when(AUDITS.createAudit("https://example.com")).thenThrow(new IllegalStateException("storage unavailable"));
        assertEquals(500, post("/audits", "{\"url\":\"https://example.com\"}").statusCode());
    }

    @Test void newsletterContractCoversMissingInvalidAndAcceptedSubscriptions() throws Exception {
        assertEquals(400, post("/newsletter/subscribe", "{}").statusCode());
        verifyNoInteractions(NEWSLETTER);
        when(NEWSLETTER.subscribe(eq("bad"), any())).thenReturn(NewsletterService.SubscribeResult.INVALID_EMAIL);
        var invalid = post("/newsletter/subscribe", "{\"email\":\"bad\"}");
        assertEquals(400, invalid.statusCode());
        assertEquals("error", MAPPER.readTree(invalid.body()).path("status").asText());

        when(NEWSLETTER.subscribe(eq("person@example.com"), any()))
            .thenReturn(NewsletterService.SubscribeResult.ALREADY_SUBSCRIBED);
        var accepted = post("/newsletter/subscribe", "{\"email\":\"person@example.com\"}");
        assertEquals(200, accepted.statusCode());
        assertEquals("ok", MAPPER.readTree(accepted.body()).path("status").asText());
        assertEquals("no-store", accepted.headers().firstValue("Cache-Control").orElseThrow());
    }
}
