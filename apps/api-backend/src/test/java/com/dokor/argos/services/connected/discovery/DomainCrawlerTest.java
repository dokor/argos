package com.dokor.argos.services.connected.discovery;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.typesafe.config.ConfigFactory;

import org.junit.jupiter.api.*;

import java.time.Duration;
import java.util.*;

class DomainCrawlerTest {
    DiscoveryPolicy policy;
    DiscoveryTransport transport;
    List<String> fetched;
    Map<String, DiscoveryTransport.Response> responses;
    List<DomainCrawler.Page> pages;

    @BeforeEach
    void setup() {
        policy = new DiscoveryPolicy(ConfigFactory.empty());
        transport = mock(DiscoveryTransport.class);
        fetched = new ArrayList<>();
        responses = new HashMap<>();
        pages = new ArrayList<>();
        when(transport.get(anyString(), anyInt(), any()))
                .thenAnswer(
                        call -> {
                            String url = call.getArgument(0);
                            fetched.add(url);
                            return responses.getOrDefault(
                                    url,
                                    new DiscoveryTransport.Response(404, "text/plain", null, ""));
                        });
    }

    void html(String path, String body) {
        responses.put(
                "https://example.com" + path,
                new DiscoveryTransport.Response(200, "text/html; charset=utf-8", null, body));
    }

    void robots(String body) {
        responses.put(
                "https://example.com/robots.txt",
                new DiscoveryTransport.Response(200, "text/plain", null, body));
    }

    void xml(String path, String body) {
        responses.put(
                "https://example.com" + path,
                new DiscoveryTransport.Response(200, "application/xml", null, body));
    }

    DomainCrawler.Result run(int max, int depth, List<String> exclusions) {
        var input = new CreateDiscovery("example.com", (long) max, (long) depth, exclusions);
        return new DomainCrawler(policy, transport)
                .crawl(
                        input,
                        policy.limits(input),
                        new DiscoveryBudget(Duration.ofSeconds(5), () -> false),
                        pages::add);
    }

    @Test
    void exactHostDedupFragmentsExclusionsAndDepthAreAppliedBeforeTransport() {
        html(
                "",
                "<a href='/ok#one'>one</a><a href='/ok#two'>two</a><a"
                    + " href='https://sub.example.com/a'>external</a><a"
                    + " href='/private/x'>private</a>");
        html("/ok", "<a href='/too-deep'>deeper</a>");
        var result = run(50, 1, List.of("/private"));
        assertEquals(2, pages.stream().filter(DomainCrawler.Page::eligible).count());
        assertEquals(1, Collections.frequency(fetched, "https://example.com/ok"));
        assertTrue(pages.stream().anyMatch(p -> "EXTERNAL_HOST".equals(p.reason())));
        assertTrue(pages.stream().anyMatch(p -> "EXCLUDED_PATH".equals(p.reason())));
        assertEquals("DEPTH_LIMIT", result.reason());
        assertFalse(
                fetched.stream()
                        .anyMatch(
                                u ->
                                        u.contains("sub.example.com")
                                                || u.contains("private")
                                                || u.contains("too-deep")));
    }

    @Test
    void robotsGroupsAndEncodedExclusionsPreventRequests() {
        robots(
                "User-agent: *\n"
                    + "Disallow: /wildcard\n"
                    + "User-agent: ArgosDiscovery\n"
                    + "Disallow: /blocked\n"
                    + "Allow: /blocked/open\n");
        html(
                "",
                "<a href='/blocked'>no</a><a href='/blocked/open'>yes</a><a"
                    + " href='/%70rivate/x'>encoded</a>");
        html("/blocked/open", "");
        run(50, 3, List.of("/private"));
        assertFalse(fetched.contains("https://example.com/blocked"));
        assertFalse(fetched.stream().anyMatch(u -> u.contains("%70")));
        assertTrue(fetched.contains("https://example.com/blocked/open"));
    }

    @Test
    void redirectsAreBoundedAndExternalTargetNeverFetched() {
        responses.put(
                "https://example.com",
                new DiscoveryTransport.Response(302, "text/html", "http://127.0.0.1/secret", ""));
        var result = run(50, 3, List.of());
        assertEquals("EXTERNAL_HOST", result.reason());
        assertFalse(fetched.stream().anyMatch(u -> u.contains("127.0.0.1")));
        assertFalse(pages.getFirst().eligible());
    }

    @Test
    void redirectRelativeLinksUseFinalPathAndRobotsOnEachHop() {
        responses.put(
                "https://example.com",
                new DiscoveryTransport.Response(302, "text/html", "/section/", ""));
        html("/section/", "<a href='child'>child</a>");
        html("/section/child", "");
        run(50, 3, List.of());
        assertTrue(fetched.contains("https://example.com/section/child"));
        assertFalse(fetched.contains("https://example.com/child"));
    }

    @Test
    void sitemapIndexIsBoundedAndExternalMapIsRecordedWithoutFetch() {
        html("", "");
        robots("User-agent: *\nSitemap: https://outside.example.com/map.xml\n");
        xml(
                "/sitemap.xml",
                "<sitemapindex><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>");
        xml("/pages.xml", "<urlset><url><loc>https://example.com/from-map</loc></url></urlset>");
        html("/from-map", "");
        run(50, 3, List.of());
        assertTrue(
                pages.stream()
                        .anyMatch(p -> p.source() == DiscoverySource.SITEMAP && p.eligible()));
        assertFalse(fetched.stream().anyMatch(u -> u.contains("outside")));
    }

    @Test
    void externalXmlEntitiesAreNeverResolved() {
        html("", "");
        xml(
                "/sitemap.xml",
                "<!DOCTYPE urlset [<!ENTITY x SYSTEM"
                    + " 'file:///secret'>]><urlset><url><loc>&x;</loc></url></urlset>");
        var result = run(50, 3, List.of());
        assertTrue(Set.of("XML_UNSAFE", "INVALID_SITEMAP").contains(result.reason()));
        assertEquals(1, pages.size());
        assertTrue(result.truncated());
    }
    @Test void relativeLinksRespectTheHtmlBase() {
        html("", "<base href='/app/'><a href='products'>products</a>");
        html("/app/products", "");
        run(50, 3, List.of());
        assertTrue(fetched.contains("https://example.com/app/products"));
        assertFalse(fetched.contains("https://example.com/products"));
        assertEquals(2, pages.stream().filter(DomainCrawler.Page::eligible).count());
    }
    @Test void externalHtmlBaseCannotEscapeHostOrPathExclusions() {
        html("", "<base href='https://outside.example.com/app/'><a href='products'>products</a>");
        run(50, 3, List.of());
        assertFalse(fetched.stream().anyMatch(url -> url.contains("outside.example.com")));
        assertTrue(pages.stream().anyMatch(page -> "EXTERNAL_HOST".equals(page.reason())));
        pages.clear();fetched.clear();
        html("", "<base href='/private/'><a href='products'>products</a>");
        run(50, 3, List.of("/private"));
        assertFalse(fetched.contains("https://example.com/private/products"));
        assertTrue(pages.stream().anyMatch(page -> "EXCLUDED_PATH".equals(page.reason())));
    }
    @Test void duplicateSitemapsDoNotStopTheHomePage() {
        robots("User-agent: *\nAllow: /\n" + "Sitemap: https://example.com/sitemap.xml\n".repeat(6));
        html("", "");
        var result=run(50, 3, List.of());
        assertEquals("EXHAUSTED",result.reason());assertFalse(result.truncated());
        assertTrue(pages.getFirst().eligible());
        assertEquals(1,Collections.frequency(fetched,"https://example.com/sitemap.xml"));
    }
    @Test void distinctSitemapOverflowKeepsHtmlPagesAndIsExplicitlyTruncated() {
        var body=new StringBuilder("User-agent: *\nAllow: /\n");
        for(int n=0;n<6;n++)body.append("Sitemap: https://example.com/map-").append(n).append(".xml\n");
        robots(body.toString());html("", "<a href='/ok'>ok</a>");html("/ok", "");
        var result=run(50,3,List.of());
        assertEquals("SITEMAP_LIMIT",result.reason());assertTrue(result.truncated());
        assertEquals(2,pages.stream().filter(DomainCrawler.Page::eligible).count());
        assertEquals(5,fetched.stream().filter(url->url.endsWith(".xml")).count());
        assertFalse(fetched.contains("https://example.com/map-5.xml"));
    }

    @Test
    void robotsFailureFailsClosedAndKeepsExplicitExclusion() {
        responses.put(
                "https://example.com/robots.txt",
                new DiscoveryTransport.Response(503, "text/plain", null, ""));
        assertEquals("ROBOTS_UNAVAILABLE", run(50, 3, List.of()).reason());
        assertFalse(fetched.contains("https://example.com"));
        assertEquals("ROBOTS_UNAVAILABLE", pages.getFirst().reason());
    }

    @Test
    void urlBudgetBoundsSnapshotAndFetches() {
        html("", "<a href='/a'>a</a><a href='/b'>b</a><a href='/c'>c</a>");
        html("/a", "");
        html("/b", "");
        var result = run(2, 3, List.of());
        assertEquals(2, pages.size());
        assertEquals("URL_LIMIT", result.reason());
        assertFalse(fetched.contains("https://example.com/b"));
    }

    @Test
    void cancellationPreservesAlreadyDiscoveredPage() {
        html("", "<a href='/a'>a</a>");
        boolean[] canceled = {false};
        var input = new CreateDiscovery("example.com", 50L, 3L, List.of());
        var result =
                new DomainCrawler(policy, transport)
                        .crawl(
                                input,
                                policy.limits(input),
                                new DiscoveryBudget(Duration.ofSeconds(3), () -> canceled[0]),
                                p -> {
                                    pages.add(p);
                                    canceled[0] = true;
                                });
        assertEquals("CANCELED", result.reason());
        assertEquals(1, pages.size());
        assertTrue(pages.getFirst().eligible());
    }

    @Test
    void contentAndRedirectLoopAreExplicit() {
        responses.put(
                "https://example.com",
                new DiscoveryTransport.Response(200, "application/pdf", null, "binary"));
        assertEquals("NOT_HTML", run(50, 3, List.of()).reason());
        pages.clear();
        responses.put(
                "https://example.com", new DiscoveryTransport.Response(301, "text/html", "/", ""));
        assertEquals("REDIRECT_LOOP", run(50, 3, List.of()).reason());
    }

    @Test void configuredDiscoveryTraversesBeyondFiftyAndDepthThree() {
        policy = new DiscoveryPolicy(ConfigFactory.parseString("discovery.max-urls=200\ndiscovery.max-depth=5"));
        StringBuilder root = new StringBuilder();
        for (int n=0;n<60;n++) {root.append("<a href='/p"+n+"'>p</a>");html("/p"+n, "");}
        root.append("<a href='/d1'>deep</a>"); html("",root.toString());
        for(int n=1;n<=5;n++) html("/d"+n,n<5?"<a href='/d"+(n+1)+"'>next</a>":"");
        var result=run(200,5,List.of());
        assertEquals(66,pages.stream().filter(DomainCrawler.Page::eligible).count());
        assertTrue(fetched.contains("https://example.com/d5"));
        assertEquals("EXHAUSTED",result.reason());
    }
    @Test void engineRestrictsForgedOrOldSnapshotWithoutTrustingCaller() {
        StringBuilder root = new StringBuilder();
        for(int n=0;n<80;n++){root.append("<a href='/p"+n+"'>p</a>");html("/p"+n,"");}
        html("",root.toString());
        var input=new CreateDiscovery("example.com",200L,5L,List.of());
        var result=new DomainCrawler(policy,transport).crawl(input,new DiscoveryLimits(200L,5L,300L,2L),
            new DiscoveryBudget(Duration.ofSeconds(10),()->false),pages::add);
        assertEquals(50,pages.size());assertEquals("URL_LIMIT",result.reason());
        assertTrue(fetched.size()<=52);
    }
    @Test void requestsHaveIndependentBudgetIncludingRobotsAndRedirects() {
        policy=new DiscoveryPolicy(ConfigFactory.parseString("discovery.max-requests=2"));
        html("","<a href='/child'>child</a>");html("/child","");
        var result=run(50,3,List.of());
        assertEquals("REQUEST_LIMIT",result.reason());assertTrue(result.truncated());
        assertEquals(2,fetched.size());
    }
}
