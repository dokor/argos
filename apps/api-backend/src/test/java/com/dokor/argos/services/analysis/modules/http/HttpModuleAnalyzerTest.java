package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.CheckMergerService;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.report.PublicReportComposer;
import java.time.Instant;
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
        when(client.send(any(HttpRequest.class), any())).thenAnswer(invocation -> {
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
            resp(403, "<html><title>Just a moment...</title><script>window._cf_chl_opt = {};</script></html>",
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

    @Test
    void cloudflareMaintenanceForbiddenAndQuotaResponsesRemainMeasuredFailures() throws Exception {
        for (int status : List.of(503, 403, 429)) {
            String body = switch (status) {
                case 503 -> "<html>Service unavailable - maintenance</html>";
                case 403 -> "<html>Forbidden: account has no access</html>";
                default -> "<html>API quota exceeded</html>";
            };
            var result = fixtureAnalysis(status, body, Map.of("server", List.of("cloudflare"), "cf-ray", List.of("fixture")));
            assertEquals(false, result.data().get("antiBotDetected"));
            assertEquals("cloudflare", result.data().get("cdnProvider"));
            assertEquals("HTTP_ERROR_WITHOUT_CHALLENGE_EVIDENCE", result.data().get("antiBotReason"));
            assertEquals(List.of(), result.data().get("antiBotEvidence"));
            assertFalse(result.data().containsKey("antiBotVendor"));
            assertEquals(status, result.data().get("statusCode"));
            assertEquals(AuditStatus.FAIL, checkByKey(result, "http.status_code").status());
            assertFalse(result.checks().stream().anyMatch(c -> c.key().equals("http.antibot.challenge")));
            assertScoringAndCoverage(result, false);
        }
    }

    @Test
    void explicitCloudflareHeaderConfirmsChallengesIncludingHttp200() throws Exception {
        for (int status : List.of(200, 403, 429, 503)) {
            var result = fixtureAnalysis(status, "<html>Custom challenge</html>", Map.of("cf-mitigated", List.of("challenge")));
            assertEquals(true, result.data().get("antiBotDetected"));
            assertEquals("cloudflare", result.data().get("antiBotVendor"));
            assertEquals("CF_MITIGATED_CHALLENGE", result.data().get("antiBotReason"));
            assertEquals(List.of("header:cf-mitigated=challenge"), result.data().get("antiBotEvidence"));
            assertEquals(result.data().get("antiBotEvidence"), checkByKey(result, "http.antibot.challenge").details().get("evidence"));
            assertEquals(AuditStatus.INFO, checkByKey(result, "http.status_code").status());
            assertScoringAndCoverage(result, true);
        }
    }

    @Test
    void challengeHtmlIsRecognizedWithoutInferringItFromCdnOrStatus() throws Exception {
        for (String body : List.of("<html><script>window._cf_chl_opt = {cType:'managed'};</script></html>",
            "<html><form id='cf-browser-verification'>Verify</form></html>")) {
            var result = fixtureAnalysis(200, body, Map.of());
            assertEquals(true, result.data().get("antiBotDetected"));
            assertEquals("cloudflare", result.data().get("antiBotVendor"));
            assertFalse(result.data().containsKey("cdnProvider"));
            assertEquals("CLOUDFLARE_CHALLENGE_HTML", result.data().get("antiBotReason"));
            assertScoringAndCoverage(result, true);
        }
    }

    @Test
    void ambiguousTextInvalidMitigationAndEmbeddedTurnstileNeverConfirmChallenge() throws Exception {
        for (String body : List.of("<html><title>Just a moment...</title>Maintenance</html>",
            "<html><h1>Attention required</h1>Renew your subscription</html>",
            "<html>Checking your browser compatibility</html>",
            "<html><script src='https://challenges.cloudflare.com/turnstile/v0/api.js'></script><form>Contact us</form></html>",
            "<html><script src='/cdn-cgi/challenge-platform/scripts/jsd/main.js'></script>Welcome</html>")) {
            var result = fixtureAnalysis(503, body, Map.of("server", List.of("cloudflare"), "cf-mitigated", List.of("guardrails")));
            assertEquals(false, result.data().get("antiBotDetected"));
            assertEquals(AuditStatus.FAIL, checkByKey(result, "http.status_code").status());
            assertScoringAndCoverage(result, false);
        }
    }

    @Test
    void genericVerificationKeepsCdnProviderSeparateFromChallengeVendor() throws Exception {
        var result = fixtureAnalysis(403, "Checking your browser before accessing the site",
            Map.of("server", List.of("cloudflare")));
        assertEquals("cloudflare", result.data().get("cdnProvider"));
        assertEquals("generic", result.data().get("antiBotVendor"));
        assertEquals("BROWSER_VERIFICATION_PAGE", result.data().get("antiBotReason"));
        assertScoringAndCoverage(result, true);
    }

    private AuditModuleResult fixtureAnalysis(int status, String body, Map<String, List<String>> headers) throws Exception {
        var analyzer = new HttpModuleAnalyzer(stubClient(resp(status, body, headers, HttpClient.Version.HTTP_2),
            resp(404, "missing"), resp(404, "missing")));
        return analyzer.analyze(new AuditContext("https://example.com", "https://example.com", 0L), LoggerFactory.getLogger("test"));
    }

    private void assertScoringAndCoverage(AuditModuleResult http, boolean challenge) {
        var policy = new DefaultScorePolicy();
        var raw = List.of(http, dependent("html", "html.title"), dependent("runtime", "runtime.console.errors"),
            dependent("lighthouse", "lighthouse.score.performance"), dependent("tech", "tech.security.version_disclosure"),
            dependent("ssl", "ssl.grade"));
        var enriched = new ScoreEnricherService(policy).enrich(new CheckMergerService().merge(raw));
        var score = new ScoreService(policy).compute(policy.version(), policy.fingerprint(), enriched);
        for (String key : List.of("http.status_code", "http.security.hsts", "html.title", "runtime.console.errors",
            "lighthouse.score.performance", "tech.security.version_disclosure")) {
            var covered = score.coverage().checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
            assertEquals(challenge ? MeasurementCoverage.State.BLOCKED_BY_ANTIBOT : MeasurementCoverage.State.MEASURED, covered.state(), key);
            var scored = score.checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
            assertEquals(!challenge, scored.scorable(), key);
            if (challenge) assertEquals(0, scored.weight(), key);
            else assertTrue(scored.weight() > 0, key);
        }
        assertEquals(MeasurementCoverage.State.MEASURED, score.coverage().checks().stream()
            .filter(c -> c.key().equals("ssl.grade")).findFirst().orElseThrow().state());
        var meta = challenge ? Map.of("antiBotDetected", "true", "antiBotVendor", (String) http.data().get("antiBotVendor"))
            : Map.<String, String>of();
        var report = new PublicReportComposer().compose(new AuditReportJson(6, "https://example.com", "https://example.com",
            Instant.now(), meta, enriched, score));
        if (challenge) assertTrue(report.antiBot().detected());
        else {
            assertNull(report.antiBot());
            assertTrue(report.issues().stream().anyMatch(i -> i.id().equals("http.status_code")));
        }
    }

    private AuditModuleResult dependent(String module, String key) {
        var check = AuditCheckResult.of(key, key, AuditStatus.FAIL, AuditSeverity.MEDIUM, false, 0,
            List.of(), false, Map.of(), "fixture", "fix");
        return new AuditModuleResult(module, module, null, Map.of(), List.of(check));
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
        when(client.send(any(HttpRequest.class), any())).thenAnswer(inv -> redirect);

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
