package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires de {@link HttpModuleAnalyzer}.
 * <p>
 * Les tests de la méthode {@code analyze} qui font de vraies requêtes HTTP utilisent
 * des URLs garanties injoignables (port 1) pour vérifier la gestion des erreurs réseau
 * sans dépendance externe.
 * <p>
 * Les tests de {@link HttpModuleAnalyzer#enrichContext} valident l'extraction des données
 * du résultat HTTP vers l'{@link AuditContext}.
 */
class HttpModuleAnalyzerTest {

    private final HttpModuleAnalyzer analyzer = new HttpModuleAnalyzer();

    // -------------------------
    // enrichContext
    // -------------------------

    @Test
    void enrichContext_shouldPopulateHttpFields() {
        AuditContext initial = new AuditContext("http://example.com", "https://example.com", 0L);

        Map<String, Object> data = Map.of(
            "finalUrl", "https://example.com",
            "statusCode", 200,
            "durationMs", 120L,
            "redirectChain", List.of("http://example.com", "https://example.com"),
            "headers", Map.of("content-type", "text/html"),
            "body", "<html/>"
        );
        AuditModuleResult httpResult = new AuditModuleResult("http", "HTTP", "ok", data, List.of());

        AuditContext enriched = HttpModuleAnalyzer.enrichContext(initial, httpResult);

        assertEquals("https://example.com", enriched.finalUrl());
        assertEquals(200, enriched.httpStatusCode());
        assertEquals(120L, enriched.httpDurationMs());
        assertEquals(2, enriched.redirectChain().size());
        assertEquals("text/html", enriched.headers().get("content-type"));
        assertEquals("<html/>", enriched.body());
    }

    @Test
    void enrichContext_shouldHandleNullBody() {
        AuditContext initial = new AuditContext("https://example.com", "https://example.com", 0L);

        Map<String, Object> data = Map.of(
            "finalUrl", "https://example.com",
            "statusCode", 200,
            "durationMs", 50L,
            "redirectChain", List.of("https://example.com"),
            "headers", Map.of()
        );
        AuditModuleResult httpResult = new AuditModuleResult("http", "HTTP", "ok", data, List.of());

        AuditContext enriched = HttpModuleAnalyzer.enrichContext(initial, httpResult);

        assertNull(enriched.body());
        assertEquals("https://example.com", enriched.finalUrl());
    }

    @Test
    void enrichContext_shouldHandleNullRedirectChainAndHeaders() {
        AuditContext initial = new AuditContext("https://example.com", "https://example.com", 0L);

        // Simule un résultat avec redirectChain/headers absents de la map
        Map<String, Object> data = Map.of(
            "finalUrl", "https://example.com",
            "statusCode", 200,
            "durationMs", 10L
        );
        AuditModuleResult httpResult = new AuditModuleResult("http", "HTTP", "ok", data, List.of());

        AuditContext enriched = HttpModuleAnalyzer.enrichContext(initial, httpResult);

        assertNotNull(enriched.redirectChain());
        assertNotNull(enriched.headers());
    }

    // -------------------------
    // analyze - gestion d'erreur réseau
    // -------------------------

    @Test
    void analyze_shouldHandleConnectionRefused() {
        // Port 1 est systématiquement fermé
        AuditContext ctx = new AuditContext("http://localhost:1", "http://localhost:1", 0L);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals("http", result.id());
        assertNotNull(result.checks());
        assertFalse(result.checks().isEmpty());

        // Le status_code doit être FAIL (statusCode=0 → no valid HTTP status)
        AuditCheckResult statusCheck = result.checks().stream()
            .filter(c -> "http.status_code".equals(c.key()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("http.status_code check not found"));

        assertEquals(AuditStatus.FAIL, statusCheck.status());
    }

    @Test
    void analyze_shouldHaveExpectedCheckKeys() {
        AuditContext ctx = new AuditContext("http://localhost:1", "http://localhost:1", 0L);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        List<String> keys = result.checks().stream().map(AuditCheckResult::key).toList();

        assertTrue(keys.contains("http.status_code"),        "Missing http.status_code");
        assertTrue(keys.contains("http.redirect.count"),     "Missing http.redirect.count");
        assertTrue(keys.contains("http.final_url.https"),    "Missing http.final_url.https");
    }

    // -------------------------
    // Seuils déterministes (issue #100) : response time & caching non scorés
    // -------------------------

    @Test
    void analyze_responseTimeShouldBeInformationalOnly() {
        // Le temps de réponse dépend du réseau du worker : il ne doit plus produire de
        // FAIL/WARN (non déterministe) mais rester purement informatif (INFO => non scoré).
        AuditContext ctx = new AuditContext("http://localhost:1", "http://localhost:1", 0L);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.INFO, checkByKey(result, "http.response_time_ms").status());
    }

    @Test
    void analyze_cachingHeadersShouldBeInformationalOnly() throws Exception {
        // Absence de header de cache sur le HTML = souvent correct : ne doit pas warner.
        HttpModuleAnalyzer mockedAnalyzer = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>"),
            resp(404, "Not found"),
            resp(404, "Not found")
        ));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = mockedAnalyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.INFO, checkByKey(result, "http.headers.caching").status());
    }

    // -------------------------
    // SEO resources: robots.txt & sitemap.xml (issue #31)
    // -------------------------

    @Test
    void analyze_shouldDetectRobotsAndSitemapWhenPresent() throws Exception {
        HttpModuleAnalyzer mockedAnalyzer = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>"),
            resp(200, "User-agent: *\nSitemap: https://example.com/sitemap.xml\n"),
            resp(200, "<urlset></urlset>")
        ));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = mockedAnalyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.PASS, checkByKey(result, "http.seo.robots_txt").status());
        assertEquals(AuditStatus.PASS, checkByKey(result, "http.seo.sitemap").status());
    }

    @Test
    void analyze_shouldWarnWhenRobotsAndSitemapMissing() throws Exception {
        HttpModuleAnalyzer mockedAnalyzer = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>"),
            resp(404, "Not found"),
            resp(404, "Not found")
        ));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = mockedAnalyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.WARN, checkByKey(result, "http.seo.robots_txt").status());
        assertEquals(AuditStatus.WARN, checkByKey(result, "http.seo.sitemap").status());
    }

    @Test
    void analyze_shouldDetectSitemapDeclaredInRobotsEvenIfXmlMissing() throws Exception {
        HttpModuleAnalyzer mockedAnalyzer = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>"),
            resp(200, "Sitemap: https://example.com/custom-sitemap.xml\n"),
            resp(404, "Not found")
        ));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = mockedAnalyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        // Sitemap déclaré dans robots.txt ⇒ considéré présent malgré /sitemap.xml en 404.
        assertEquals(AuditStatus.PASS, checkByKey(result, "http.seo.sitemap").status());
    }

    @Test
    void analyze_shouldNotProbeSeoResourcesWhenSiteRespondsWithError() throws Exception {
        HttpModuleAnalyzer mockedAnalyzer = new HttpModuleAnalyzer(stubClient(
            resp(500, "Server error"),
            resp(200, "should-not-be-requested"),
            resp(200, "should-not-be-requested")
        ));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = mockedAnalyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        List<String> keys = result.checks().stream().map(AuditCheckResult::key).toList();
        assertFalse(keys.contains("http.seo.robots_txt"), "robots probe should be skipped on 5xx");
        assertFalse(keys.contains("http.seo.sitemap"), "sitemap probe should be skipped on 5xx");
    }

    // -------------------------
    // moduleId
    // -------------------------

    @Test
    void moduleId_shouldReturnHttp() {
        assertEquals("http", analyzer.moduleId());
    }

    // -------------------------
    // Helpers pour les tests SEO
    // -------------------------

    private static AuditCheckResult checkByKey(AuditModuleResult result, String key) {
        return result.checks().stream()
            .filter(c -> key.equals(c.key()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("check not found: " + key));
    }

    /**
     * Construit un HttpClient mocké qui répond selon l'URL demandée :
     * /robots.txt → robotsResp, /sitemap.xml → sitemapResp, sinon → mainResp.
     */
    private static HttpClient stubClient(
        HttpResponse<String> mainResp,
        HttpResponse<String> robotsResp,
        HttpResponse<String> sitemapResp
    ) throws Exception {
        HttpClient client = mock(HttpClient.class);
        when(client.<String>send(any(HttpRequest.class), any())).thenAnswer(invocation -> {
            HttpRequest req = invocation.getArgument(0);
            String uri = req.uri().toString();
            if (uri.endsWith("/robots.txt")) return robotsResp;
            if (uri.endsWith("/sitemap.xml")) return sitemapResp;
            return mainResp;
        });
        return client;
    }

    // -------------------------
    // Détection anti-bot (issue #56)
    // -------------------------

    @Test
    void analyze_detectsCloudflareChallengeAndDoesNotPenalize() throws Exception {
        HttpModuleAnalyzer a = new HttpModuleAnalyzer(stubClient(
            resp(403, "<html><title>Just a moment...</title></html>",
                Map.of("cf-ray", List.of("abc123"), "server", List.of("cloudflare")),
                HttpClient.Version.HTTP_2),
            resp(404, "x"), resp(404, "x")));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = a.analyze(ctx, LoggerFactory.getLogger("test"));

        // Check anti-bot informatif émis.
        AuditCheckResult antibot = checkByKey(result, "http.antibot.challenge");
        assertEquals(AuditStatus.INFO, antibot.status());
        assertEquals("cloudflare", antibot.value());
        // Le statut 403 du challenge n'est PAS pénalisant (INFO au lieu de FAIL).
        assertEquals(AuditStatus.INFO, checkByKey(result, "http.status_code").status());
        // Flags exposés dans data.
        assertEquals(true, result.data().get("antiBotDetected"));
        assertEquals("cloudflare", result.data().get("antiBotVendor"));
    }

    @Test
    void analyze_normalCloudflareSiteIsNotFlagged() throws Exception {
        // CDN Cloudflare sur une 200 sans marqueur => pas de challenge (pas de faux positif).
        HttpModuleAnalyzer a = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html><body>Bienvenue</body></html>",
                Map.of("cf-ray", List.of("abc123"), "server", List.of("cloudflare")),
                HttpClient.Version.HTTP_2),
            resp(404, "x"), resp(404, "x")));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = a.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(false, result.data().get("antiBotDetected"));
        assertEquals(AuditStatus.PASS, checkByKey(result, "http.status_code").status());
    }

    @Test
    void detectAntiBot_genericChallengeByBodyMarkerAndStatus() {
        assertEquals("generic",
            HttpModuleAnalyzer.detectAntiBot(503, Map.of(), "Checking your browser before accessing the site"));
    }

    @Test
    void detectAntiBot_normalSiteReturnsNull() {
        assertNull(HttpModuleAnalyzer.detectAntiBot(200, Map.of("server", "nginx"), "<html><body>Hello</body></html>"));
    }

    @Test
    void checkStatusCode_challengeIsInfoNotFail() {
        assertEquals(AuditStatus.INFO, HttpModuleAnalyzer.checkStatusCode(403, true).status());
        assertEquals(AuditStatus.FAIL, HttpModuleAnalyzer.checkStatusCode(403, false).status());
    }

    // -------------------------
    // SSRF : revalidation des redirections (#217)
    // -------------------------

    @Test
    @SuppressWarnings("unchecked")
    void analyze_shouldNotFollowRedirectToPrivateAddress() throws Exception {
        HttpClient client = mock(HttpClient.class);
        // Redirection d'un site public vers l'endpoint de métadonnées cloud (SSRF).
        HttpResponse<String> redirect = resp(302, "",
            Map.of("location", List.of("http://127.0.0.1/latest/meta-data/")), HttpClient.Version.HTTP_1_1);
        when(client.<String>send(any(HttpRequest.class), any())).thenAnswer(inv -> redirect);

        HttpModuleAnalyzer a = new HttpModuleAnalyzer(client);
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = a.analyze(ctx, LoggerFactory.getLogger("test"));

        List<String> errors = (List<String>) result.data().get("errors");
        assertNotNull(errors);
        assertTrue(errors.stream().anyMatch(e -> e.startsWith("SsrfBlocked")),
            "expected an SsrfBlocked error, got: " + errors);

        // La cible interne n'a jamais été requêtée : un seul send (l'URL publique initiale).
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(client, times(1)).send(captor.capture(), any());
        assertEquals("https://example.com", captor.getValue().uri().toString());
        assertIncompleteSnapshot(result, "TARGET_BLOCKED", "https://example.com", 302);
    }

    @Test
    void redirectFollowedByTimeoutDoesNotPublishTheRedirectBodyAsTargetContent() throws Exception {
        HttpClient client = mock(HttpClient.class);
        var redirect = resp(301, "initial response", Map.of("location", List.of("https://example.com/target"),
            "server", List.of("initial-server")), HttpClient.Version.HTTP_1_1);
        when(client.<String>send(any(HttpRequest.class), any())).thenReturn(redirect)
            .thenThrow(new java.net.http.HttpTimeoutException("fixture timeout"));
        var result = analyzeWith(client);
        assertIncompleteSnapshot(result, "TIMEOUT", "https://example.com", 301);
        assertEquals("https://example.com/target", result.data().get("requestedUrl"));
        assertTrue(result.data().get("errors").toString().contains("HttpTimeoutException"));
        verify(client, times(2)).send(any(), any()); // no SEO probe of the unvisited target
    }

    @Test
    void redirectLimitIsExplicitAndDoesNotExposeTheNextTargetsSnapshot() throws Exception {
        HttpClient client = mock(HttpClient.class);
        var count = new java.util.concurrent.atomic.AtomicInteger();
        when(client.<String>send(any(HttpRequest.class), any())).thenAnswer(call -> {
            int next = count.incrementAndGet();
            return resp(302, "redirect body " + next, Map.of("location", List.of("/hop/" + next)), HttpClient.Version.HTTP_1_1);
        });
        var result = analyzeWith(client);
        assertIncompleteSnapshot(result, "REDIRECT_LIMIT", "https://example.com/hop/9", 302);
        assertEquals("https://example.com/hop/9", result.data().get("requestedUrl"));
        assertEquals("https://example.com/hop/10", result.data().get("targetUrl"));
        assertTrue(result.data().get("errors").toString().contains("RedirectLimitExceeded"));
        verify(client, times(10)).send(any(), any());
    }

    @Test
    void redirectLoopStopsBeforeRefetchingTheSameUrl() throws Exception {
        HttpClient client = mock(HttpClient.class);
        var first = resp(302, "first redirect", Map.of("location", List.of("/second")), HttpClient.Version.HTTP_1_1);
        var second = resp(302, "second redirect", Map.of("location", List.of("https://example.com")), HttpClient.Version.HTTP_1_1);
        when(client.<String>send(any(HttpRequest.class), any())).thenReturn(first, second);
        var result = analyzeWith(client);
        assertIncompleteSnapshot(result, "REDIRECT_LOOP", "https://example.com/second", 302);
        assertTrue(result.data().get("errors").toString().contains("RedirectLoop"));
        verify(client, times(2)).send(any(), any());
    }

    @Test
    void redirectWithMissingOrInvalidLocationHasNoFinalSnapshot() throws Exception {
        for (Map<String, List<String>> headers : List.of(Map.<String, List<String>>of(), Map.of("location", List.of("http://[")))) {
            HttpClient client = mock(HttpClient.class);
            var redirect = resp(301, "redirect response", headers, HttpClient.Version.HTTP_1_1);
            when(client.<String>send(any(HttpRequest.class), any())).thenReturn(redirect);
            var result = analyzeWith(client);
            assertIncompleteSnapshot(result, headers.isEmpty() ? "MISSING_LOCATION" : "INVALID_LOCATION", "https://example.com", 301);
            verify(client).send(any(), any());
        }
    }

    @Test
    void successfulChainPublishesOnlyTheReachedTerminalResponse() throws Exception {
        HttpClient client = mock(HttpClient.class);
        var redirect = resp(301, "initial response", Map.of("location", List.of("/target"), "server", List.of("initial")), HttpClient.Version.HTTP_1_1);
        var terminal = resp(200, "<html>final response</html>", Map.of("server", List.of("final")), HttpClient.Version.HTTP_2);
        var missing = resp(404, "missing");
        when(client.<String>send(any(HttpRequest.class), any())).thenReturn(redirect, terminal, missing, missing);
        var result = analyzeWith(client);
        assertEquals("COMPLETED", result.data().get("fetchOutcome"));
        assertEquals(true, result.data().get("responseSnapshotAvailable"));
        assertEquals("https://example.com/target", result.data().get("finalUrl"));
        assertEquals("https://example.com/target", result.data().get("requestedUrl"));
        assertEquals(200, result.data().get("statusCode"));
        assertEquals("<html>final response</html>", result.data().get("body"));
        assertEquals(Map.of("server", "final"), result.data().get("headers"));
        var context = HttpModuleAnalyzer.enrichContext(new AuditContext("https://example.com", "https://example.com", 0L), result);
        assertEquals(result.data().get("finalUrl"), context.finalUrl());
        assertEquals(200, context.httpStatusCode());
        assertEquals(result.data().get("body"), context.body());
        assertEquals(result.data().get("headers"), context.headers());
        verify(client, times(4)).send(any(), any());
    }

    private AuditModuleResult analyzeWith(HttpClient client) {
        return new HttpModuleAnalyzer(client).analyze(new AuditContext("https://example.com", "https://example.com", 0L),
            LoggerFactory.getLogger("test"));
    }

    @SuppressWarnings("unchecked")
    private void assertIncompleteSnapshot(AuditModuleResult result, String outcome, String responseUrl, int responseStatus) {
        assertEquals(outcome, result.data().get("fetchOutcome"));
        assertEquals(false, result.data().get("responseSnapshotAvailable"));
        assertNull(result.data().get("finalUrl"));
        assertEquals(0, result.data().get("statusCode"));
        assertNull(result.data().get("body"));
        assertEquals(Map.of(), result.data().get("headers"));
        var last = (Map<String, Object>) result.data().get("lastResponse");
        assertEquals(responseUrl, last.get("url"));
        assertEquals(responseStatus, last.get("statusCode"));
        assertFalse(last.containsKey("body"));
        var context = HttpModuleAnalyzer.enrichContext(new AuditContext("https://example.com", "https://example.com", 0L), result);
        assertNull(context.finalUrl());
        assertNull(context.body());
        assertTrue(context.headers().isEmpty());
        assertEquals(0, context.httpStatusCode());
        var policy = new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy();
        var enriched = new com.dokor.argos.services.analysis.scoring.ScoreEnricherService(policy).enrich(List.of(result));
        var score = new com.dokor.argos.services.analysis.scoring.ScoreService(policy).compute(policy.version(), policy.fingerprint(), enriched);
        assertEquals(0, score.global().maxScore());
        assertTrue(score.coverage().checks().stream().filter(c -> c.module().equals("http"))
            .allMatch(c -> c.state() == com.dokor.argos.services.analysis.scoring.MeasurementCoverage.State.UNAVAILABLE
                && c.reason().equals("HTTP_FETCH_" + outcome)));
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<String> resp(int status, String body) {
        HttpResponse<String> r = mock(HttpResponse.class);
        when(r.statusCode()).thenReturn(status);
        when(r.body()).thenReturn(body);
        when(r.headers()).thenReturn(HttpHeaders.of(Map.of(), (a, b) -> true));
        when(r.version()).thenReturn(HttpClient.Version.HTTP_1_1);
        return r;
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<String> resp(int status, String body, Map<String, List<String>> headers, HttpClient.Version version) {
        HttpResponse<String> r = mock(HttpResponse.class);
        when(r.statusCode()).thenReturn(status);
        when(r.body()).thenReturn(body);
        when(r.headers()).thenReturn(HttpHeaders.of(headers, (a, b) -> true));
        when(r.version()).thenReturn(version);
        return r;
    }

    // -------------------------
    // Cookies & HTTP/2 (issue #151)
    // -------------------------

    @Test
    void analyze_shouldWarnWhenCookiesLackSecurityFlags() throws Exception {
        HttpModuleAnalyzer a = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>", Map.of("set-cookie", List.of("sid=abc; Path=/")), HttpClient.Version.HTTP_2),
            resp(404, "x"), resp(404, "x")));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = a.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.WARN, checkByKey(result, "http.security.cookie_flags").status());
    }

    @Test
    void analyze_shouldPassWhenCookiesHaveSecureAndHttpOnly() throws Exception {
        HttpModuleAnalyzer a = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>", Map.of("set-cookie", List.of("sid=abc; Secure; HttpOnly")), HttpClient.Version.HTTP_2),
            resp(404, "x"), resp(404, "x")));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = a.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.PASS, checkByKey(result, "http.security.cookie_flags").status());
    }

    @Test
    void analyze_shouldWarnHttp2WhenHttpsServedInHttp1() throws Exception {
        HttpModuleAnalyzer a = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>", Map.of(), HttpClient.Version.HTTP_1_1),
            resp(404, "x"), resp(404, "x")));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = a.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.WARN, checkByKey(result, "http.protocol.http2").status());
    }

    @Test
    void analyze_shouldPassHttp2WhenServedInHttp2() throws Exception {
        HttpModuleAnalyzer a = new HttpModuleAnalyzer(stubClient(
            resp(200, "<html></html>", Map.of(), HttpClient.Version.HTTP_2),
            resp(404, "x"), resp(404, "x")));
        AuditContext ctx = new AuditContext("https://example.com", "https://example.com", 0L);

        AuditModuleResult result = a.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(AuditStatus.PASS, checkByKey(result, "http.protocol.http2").status());
    }
}
