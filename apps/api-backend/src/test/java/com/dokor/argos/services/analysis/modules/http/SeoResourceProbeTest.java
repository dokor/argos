package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.AuditDeadline;
import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.scoring.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;

import java.net.http.*;
import java.time.Duration;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class SeoResourceProbeTest {
    private static final String ORIGIN = "https://example.com";
    private static final String XML = "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>https://example.com/</loc></url></urlset>";
    private final HttpClient client = mock(HttpClient.class);
    private final List<String> requested = new ArrayList<>();

    private void responses(Map<String, Object> responses) throws Exception {
        when(client.<String>send(any(HttpRequest.class), any())).thenAnswer(inv -> {
            HttpRequest request = inv.getArgument(0);
            String url = request.uri().toString();
            requested.add(url);
            Object response = responses.get(url);
            if (response instanceof Exception failure) throw failure;
            assertNotNull(response, "Unexpected request: " + url);
            return response;
        });
    }

    private SeoResourceProbe.Result collect() {
        return new SeoResourceProbe(client, LoggerFactory.getLogger("test")).collect(ORIGIN);
    }

    @Test void timeoutIsUnavailableAndExcludedFromScoringAndCoverage() throws Exception {
        responses(Map.of(ORIGIN, response(200, "<html></html>"),
            ORIGIN + "/robots.txt", new HttpTimeoutException("worker timeout"),
            ORIGIN + "/sitemap.xml", new HttpTimeoutException("worker timeout")));
        AuditModuleResult http = new HttpModuleAnalyzer(client).analyze(new AuditContext(ORIGIN, ORIGIN, 0L), LoggerFactory.getLogger("test"));
        assertEquals(true, http.data().get("partial"));
        assertNull(http.data().get("robotsTxtPresent"));
        assertNull(http.data().get("sitemapPresent"));
        var policy = new DefaultScorePolicy();
        var enriched = new ScoreEnricherService(policy).enrich(List.of(http));
        var coverageReport = MeasurementCoverageService.compute(policy, enriched);
        for (String key : List.of("http.seo.robots_txt", "http.seo.sitemap")) {
            var check = enriched.getFirst().checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
            assertEquals(AuditStatus.INFO, check.status());
            assertNull(check.value());
            assertFalse(check.scorable());
            assertEquals(0.0, check.weight());
            var coverage = coverageReport.checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
            assertEquals(MeasurementCoverage.State.UNAVAILABLE, coverage.state());
            assertEquals("SEO_PROBE_TIMEOUT", coverage.reason());
        }
        // Other measured HTTP checks retain their contribution.
        assertTrue(enriched.getFirst().checks().stream().anyMatch(c -> c.scorable() && c.weight() > 0));
    }

    @Test void notFoundIsMeasuredAbsence() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(404, "html error"), ORIGIN + "/sitemap.xml", response(410, "gone")));
        var result = collect();
        assertEquals(SeoResourceProbe.State.ABSENT, result.robots().state());
        assertEquals(SeoResourceProbe.State.ABSENT, result.sitemap().state());
        assertFalse(result.unavailable());
    }

    @Test void missingAndInvalidResourcesRemainScorableDefects() throws Exception {
        responses(Map.of(ORIGIN, response(200, "<html></html>"),
            ORIGIN + "/robots.txt", response(404, "missing"),
            ORIGIN + "/sitemap.xml", response(200, "<html>SPA error</html>")));
        var http = new HttpModuleAnalyzer(client).analyze(new AuditContext(ORIGIN, ORIGIN, 0L), LoggerFactory.getLogger("test"));
        var policy = new DefaultScorePolicy();
        var enriched = new ScoreEnricherService(policy).enrich(List.of(http));
        var coverage = MeasurementCoverageService.compute(policy, enriched);
        for (String key : List.of("http.seo.robots_txt", "http.seo.sitemap")) {
            var check = enriched.getFirst().checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
            assertEquals(AuditStatus.WARN, check.status());
            assertTrue(check.scorable());
            assertTrue(check.weight() > 0);
            assertEquals(MeasurementCoverage.State.MEASURED,
                coverage.checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow().state());
        }
    }

    @Test void emptyRobotsAndSitemapIndexAreRecognized() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "# no restrictions\n"),
            ORIGIN + "/sitemap.xml", response(200, "<sitemapindex xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><sitemap><loc>https://example.com/part.xml</loc></sitemap></sitemapindex>")));
        var result = collect();
        assertEquals(SeoResourceProbe.State.RECOGNIZED, result.robots().state());
        assertEquals(SeoResourceProbe.State.RECOGNIZED, result.sitemap().state());
    }

    @Test void htmlContentTypeIsInvalidEvenWithRecognizableBody() throws Exception {
        var robots = response(200, "User-agent: *");
        var sitemap = response(200, XML);
        var headers = HttpHeaders.of(Map.of("content-type", List.of("text/html")), (a, b) -> true);
        when(robots.headers()).thenReturn(headers);
        when(sitemap.headers()).thenReturn(headers);
        responses(Map.of(ORIGIN + "/robots.txt", robots, ORIGIN + "/sitemap.xml", sitemap));
        var result = collect();
        assertEquals(SeoResourceProbe.State.INVALID, result.robots().state());
        assertEquals(SeoResourceProbe.State.INVALID, result.sitemap().state());
    }

    @Test void declarationsBeyondTheBudgetDoNotBecomeAbsence() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "Sitemap: " + ORIGIN + "/one\nSitemap: " + ORIGIN + "/two\nSitemap: " + ORIGIN + "/three\nSitemap: " + ORIGIN + "/four"),
            ORIGIN + "/sitemap.xml", response(404, "missing"), ORIGIN + "/one", response(404, "missing"),
            ORIGIN + "/two", response(404, "missing"), ORIGIN + "/three", response(404, "missing")));
        assertEquals("SITEMAP_DISCOVERY_INCOMPLETE", collect().sitemap().reason());
        assertEquals(5, requested.size());
    }

    @Test void htmlFallbacksAreInvalidEvenWithoutContentType() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "<html>Not found - SPA fallback</html>"),
            ORIGIN + "/sitemap.xml", response(200, "<html>Not found - SPA fallback</html>")));
        assertEquals(SeoResourceProbe.State.INVALID, collect().robots().state());
        assertEquals(SeoResourceProbe.State.INVALID, collect().sitemap().state());
    }

    @Test void validXmlAndRobotsAreRecognized() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "User-agent: *\nDisallow:\nClean-param: ref /\n"),
            ORIGIN + "/sitemap.xml", response(200, XML)));
        var result = collect();
        assertEquals(SeoResourceProbe.State.RECOGNIZED, result.robots().state());
        assertEquals(SeoResourceProbe.State.RECOGNIZED, result.sitemap().state());
    }

    @Test void declaredCustomSitemapIsActuallyFetched() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "Sitemap: " + ORIGIN + "/custom.xml\n"),
            ORIGIN + "/sitemap.xml", response(404, "missing"), ORIGIN + "/custom.xml", response(200, XML)));
        var result = collect();
        assertEquals(SeoResourceProbe.State.RECOGNIZED, result.sitemap().state());
        assertEquals(ORIGIN + "/custom.xml", result.sitemap().url());
        assertTrue(requested.contains(ORIGIN + "/custom.xml"));
    }

    @Test void brokenDeclarationIsNotPresence() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "Sitemap: " + ORIGIN + "/broken.xml\n"),
            ORIGIN + "/sitemap.xml", response(404, "missing"), ORIGIN + "/broken.xml", response(404, "missing")));
        var result = collect();
        assertEquals(List.of(ORIGIN + "/broken.xml"), result.declarations());
        assertEquals(SeoResourceProbe.State.ABSENT, result.sitemap().state());
    }

    @Test void unreadableDeclarationKeepsSitemapUnavailable() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "Sitemap: " + ORIGIN + "/slow.xml\n"),
            ORIGIN + "/sitemap.xml", response(404, "missing"), ORIGIN + "/slow.xml", new HttpTimeoutException("timeout")));
        assertEquals(SeoResourceProbe.State.UNAVAILABLE, collect().sitemap().state());
    }

    @Test void relativeRedirectIsFollowed() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", redirect("/policy.txt"), ORIGIN + "/policy.txt", response(200, "User-agent: *"),
            ORIGIN + "/sitemap.xml", redirect("/map.xml"), ORIGIN + "/map.xml", response(200, XML)));
        var result = collect();
        assertEquals(ORIGIN + "/policy.txt", result.robots().url());
        assertEquals(ORIGIN + "/map.xml", result.sitemap().url());
        assertEquals(SeoResourceProbe.State.RECOGNIZED, result.sitemap().state());
    }

    @Test void privateRedirectAndPrivateDeclarationAreNeverRequested() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(200, "Sitemap: http://127.0.0.1/secret.xml"),
            ORIGIN + "/sitemap.xml", redirect("http://169.254.169.254/secret")));
        var result = collect();
        assertEquals("TARGET_BLOCKED", result.sitemap().reason());
        assertEquals(2, requested.size());
        assertTrue(result.candidates().stream().allMatch(c -> c.state() == SeoResourceProbe.State.UNAVAILABLE));
    }

    @Test void loopIsUnavailable() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", redirect("/robots.txt"), ORIGIN + "/sitemap.xml", response(404, "missing")));
        assertEquals("REDIRECT_LOOP", collect().robots().reason());
        assertEquals(2, requested.size());
    }

    @Test void redirectLimitIsBounded() throws Exception {
        when(client.<String>send(any(HttpRequest.class), any())).thenAnswer(inv -> {
            HttpRequest request = inv.getArgument(0);
            requested.add(request.uri().toString());
            return redirect("/hop" + requested.size());
        });
        var result = collect();
        assertEquals("REDIRECT_LIMIT", result.robots().reason());
        assertEquals("REDIRECT_LIMIT", result.sitemap().reason());
        assertEquals(12, requested.size());
    }

    @Test void sharedRequestBudgetBoundsDeclaredTargets() throws Exception {
        when(client.<String>send(any(HttpRequest.class), any())).thenAnswer(inv -> {
            HttpRequest request = inv.getArgument(0);
            requested.add(request.uri().toString());
            if (request.uri().getPath().equals("/robots.txt")) return response(200, "Sitemap: " + ORIGIN + "/custom.xml");
            return redirect("/hop" + requested.size());
        });
        var result = collect();
        assertEquals(12, requested.size());
        assertEquals("REQUEST_BUDGET_EXHAUSTED", result.candidates().getLast().reason());
    }

    @Test void expiredAuditBudgetMakesNoRequests() {
        try (var scope = new AuditDeadline(Duration.ofNanos(1)).enter()) {
            assertEquals("TIMEOUT", collect().robots().reason());
        }
        verifyNoInteractions(client);
    }

    @Test void serverErrorIsUnavailableRatherThanAbsent() throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(503, "error"), ORIGIN + "/sitemap.xml", response(403, "forbidden")));
        var result = collect();
        assertEquals(SeoResourceProbe.State.UNAVAILABLE, result.robots().state());
        assertEquals(SeoResourceProbe.State.UNAVAILABLE, result.sitemap().state());
    }

    @ParameterizedTest @ValueSource(strings = {"", "<urlset/>", "<urlset xmlns='wrong'/>",
        "<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>", "<html/>",
        "<!DOCTYPE urlset [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>&x;</urlset>"})
    void invalidXmlNeverPasses(String body) throws Exception {
        responses(Map.of(ORIGIN + "/robots.txt", response(404, "missing"), ORIGIN + "/sitemap.xml", response(200, body)));
        assertEquals(SeoResourceProbe.State.INVALID, collect().sitemap().state());
    }

    @SuppressWarnings("unchecked") private static HttpResponse<String> response(int status, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of(), (a, b) -> true));
        when(response.version()).thenReturn(HttpClient.Version.HTTP_1_1);
        return response;
    }

    private static HttpResponse<String> redirect(String location) {
        var response = response(302, "stale HTML");
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("location", List.of(location)), (a, b) -> true));
        return response;
    }
}
