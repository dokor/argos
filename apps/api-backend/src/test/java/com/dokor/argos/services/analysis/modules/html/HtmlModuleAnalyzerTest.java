package com.dokor.argos.services.analysis.modules.html;

import com.dokor.argos.services.analysis.*;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.*;

class HtmlModuleAnalyzerTest {

    private final HtmlModuleAnalyzer analyzer = new HtmlModuleAnalyzer();

    @Test
    void shouldReturnWarningWhenHtmlIsMissing() {
        AuditContext ctx = new AuditContext("http://x", "http://x")
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), null);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals("html", result.id());
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.available") && Boolean.FALSE.equals(c.value())));
    }

    @Test
    void shouldDetectBasicSeoTags() {
        String html = """
            <!doctype html>
            <html lang="fr">
              <head>
                <title>Mon super site</title>
                <meta name="description" content="desc">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="canonical" href="https://example.com/">
              </head>
              <body>
                <h1>Bienvenue</h1>
              </body>
            </html>
            """;

        AuditContext ctx = new AuditContext("http://example.com", "http://example.com")
            .withHttpResult("https://example.com", 200, 50, java.util.List.of("http://example.com", "https://example.com"),
                java.util.Map.of("content-type", "text/html"), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals("html", result.id());
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.title") && c.status() == AuditStatus.PASS));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.h1.count") && c.status() == AuditStatus.PASS));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.meta.description.present") && c.status() == AuditStatus.PASS));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.link.canonical.present") && c.status() == AuditStatus.PASS));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.lang") && c.status() == AuditStatus.PASS));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.meta.viewport.present") && c.status() == AuditStatus.PASS));
    }

    @Test
    void shouldWarnWhenMultipleH1() {
        String html = "<html><head><title>T</title></head><body><h1>A</h1><h1>B</h1></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x")
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.h1.count") && c.status() == AuditStatus.WARN));
    }

    @Test
    void shouldWarnOnMissingAltAttributes() {
        String html = "<html><head><title>T</title></head><body><img src='a.png'><img src='b.png' alt='b'></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x")
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.images.alt_coverage") && c.status() == AuditStatus.WARN));
    }

    @Test
    void shouldWarnOnAnchorsWithoutHref() {
        String html = "<html><head><title>T</title></head><body><a>click</a><a href='/ok'>ok</a></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x")
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.anchors.href_coverage") && c.status() == AuditStatus.WARN));
    }
}
