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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
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
    // analyze — gestion d'erreur réseau
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

    @SuppressWarnings("unchecked")
    private static HttpResponse<String> resp(int status, String body) {
        HttpResponse<String> r = mock(HttpResponse.class);
        when(r.statusCode()).thenReturn(status);
        when(r.body()).thenReturn(body);
        when(r.headers()).thenReturn(HttpHeaders.of(Map.of(), (a, b) -> true));
        when(r.version()).thenReturn(HttpClient.Version.HTTP_1_1);
        return r;
    }
}
