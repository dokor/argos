package com.dokor.argos.services.analysis.modules.html;

import com.dokor.argos.services.analysis.*;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.scoring.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class HtmlModuleAnalyzerTest {

    private final HtmlModuleAnalyzer analyzer = new HtmlModuleAnalyzer();

    private AuditModuleResult html(String source) {
        return analyzer.analyzeHtml("https://example.com", "https://example.com", "https://example.com/page", source,
            LoggerFactory.getLogger("test"));
    }

    private AuditCheckResult check(AuditModuleResult result, String key) {
        return result.checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
    }

    @Test
    void issueFixtureUsesRealAttributesAndElementsAndCorrectScoreContributions() {
        var result = html("""
            <html lang=fr><head><title>Example page</title>
            <meta name=description content='valid'></head><body>
            <img src='a.png' data-alt='hint'>
            <!-- <h1>Comment only</h1> -->
            </body></html>
            """);
        assertEquals(AuditStatus.PASS, check(result, "html.lang").status());
        assertEquals(AuditStatus.PASS, check(result, "html.meta.description.present").status());
        assertEquals(AuditStatus.WARN, check(result, "html.images.alt_coverage").status());
        assertEquals(AuditStatus.WARN, check(result, "html.h1.count").status());
        assertEquals(1, result.data().get("imgAltMissingCount"));
        assertEquals(0, result.data().get("h1Count"));

        var policy = new DefaultScorePolicy();
        var enriched = new ScoreEnricherService(policy).enrich(List.of(result));
        var score = new ScoreService(policy).compute(policy.version(), policy.fingerprint(), enriched);
        for (String key : List.of("html.lang", "html.meta.description.present", "html.images.alt_coverage", "html.h1.count")) {
            var scored = score.checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
            assertTrue(scored.scorable(), key);
            assertTrue(scored.weight() > 0, key);
            assertEquals(key.equals("html.lang") || key.equals("html.meta.description.present") ? 1.0 : 0.5,
                scored.score() / scored.weight(), key);
            assertEquals(MeasurementCoverage.State.MEASURED,
                score.coverage().checks().stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow().state());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "<HTML LANG=fr><HEAD><TITLE>Example &amp; page</TITLE><META CONTENT=valid NAME=DESCRIPTION><META CONTENT='WIDTH=device-width' NAME=VIEWPORT><LINK HREF=/canonical REL=CANONICAL></HEAD><BODY><H1>Real <span>heading</span></H1><IMG ALT=useful><A HREF=/ok>ok</A></BODY></HTML>",
        "<html lang='fr'><head><title>Example &amp; page</title><meta name='description' content='valid'><meta name='viewport' content='width=device-width'><link rel='alternate CANONICAL' href='/canonical'></head><body><h1>Real <span>heading</span></h1><img alt='useful'><a href='/ok'>ok</a></body></html>"
    })
    void validSyntaxVariationsHaveEquivalentResults(String source) {
        var result = html(source);
        for (String key : List.of("html.lang", "html.title", "html.meta.description.present", "html.meta.viewport.present",
            "html.link.canonical.present", "html.h1.count", "html.images.alt_coverage", "html.anchors.href_coverage")) {
            assertEquals(AuditStatus.PASS, check(result, key).status(), key);
        }
        assertEquals("Example & page", result.data().get("title"));
        assertEquals("Real heading", result.data().get("firstH1"));
    }

    @Test
    void commentsAndRawTextNeverBecomeElements() {
        var result = html("""
            <html><head>
            <!-- <!doctype html><title>Fake title</title><meta charset=utf-8><meta name=description content=fake> -->
            <script>const sample = "<h1>Fake</h1><img alt=x><a href=x></a><meta name=viewport content='width=device-width'>";</script>
            <style>/* <h1>Fake</h1><link rel=canonical href=/fake> */</style>
            </head><body><textarea><h1>Fake</h1><img alt=x></textarea></body></html>
            """);
        assertEquals(0, result.data().get("h1Count"));
        assertEquals(0, result.data().get("imgCount"));
        assertEquals(0, result.data().get("anchorCount"));
        assertEquals(1, result.data().get("scriptCount"));
        assertEquals(AuditStatus.FAIL, check(result, "html.title").status());
        for (String key : List.of("html.meta.description.present", "html.link.canonical.present",
            "html.meta.viewport.present", "html.meta.charset.present", "html.doctype.html5")) {
            assertEquals(AuditStatus.WARN, check(result, key).status(), key);
        }
    }

    @Test
    void attributeSuffixesAreNotRealAttributes() {
        var result = html("""
            <html data-lang=fr><head>
            <meta data-name=description content=valid><meta data-name=viewport content='width=device-width'>
            <meta data-charset=utf-8><link data-rel=canonical href=/ok>
            </head><body><img data-alt=hint><a data-href=/ok>action</a></body></html>
            """);
        assertEquals(AuditStatus.WARN, check(result, "html.lang").status());
        assertEquals(1, result.data().get("imgAltMissingCount"));
        assertEquals(1, result.data().get("anchorNoHrefCount"));
        for (String key : List.of("html.meta.description.present", "html.link.canonical.present",
            "html.meta.viewport.present", "html.meta.charset.present")) {
            assertEquals(AuditStatus.WARN, check(result, key).status(), key);
        }
    }

    @ParameterizedTest @ValueSource(strings = {"", " ", "&#32;", "&nbsp;"})
    void emptyMetadataValuesArePresentButNotUsable(String value) {
        var result = html("<html><head><meta name=description content='" + value + "'><link rel=canonical href='" + value
            + "'><meta name=viewport content='" + value + "'></head></html>");
        for (String key : List.of("html.meta.description.present", "html.link.canonical.present", "html.meta.viewport.present")) {
            var check = check(result, key);
            assertEquals(AuditStatus.WARN, check.status());
            assertEquals(true, check.details().get("elementPresent"));
            assertEquals(true, check.details().get("attributePresent"));
            assertEquals("EMPTY", check.details().get("state"));
            assertEquals(false, check.details().get("usable"));
        }
    }

    @Test
    void missingValuesDifferFromMissingElementsAndDataAttributes() {
        var missing = html("<html><head><meta name=description data-content=valid><link rel=canonical data-href=/ok><meta name=viewport></head></html>");
        var absent = html("<html><head></head></html>");
        for (String key : List.of("html.meta.description.present", "html.link.canonical.present", "html.meta.viewport.present")) {
            assertEquals("ATTRIBUTE_MISSING", check(missing, key).details().get("state"));
            assertEquals("ABSENT", check(absent, key).details().get("state"));
            assertNull(check(missing, key).details().get("value"));
        }
    }

    @ParameterizedTest @ValueSource(strings = {"javascript:alert(1)", "mailto:a@example.com", "https://[broken"})
    void unusableCanonicalNeverPasses(String href) {
        var result = html("<link rel=canonical href='" + href + "'>");
        assertEquals(AuditStatus.WARN, check(result, "html.link.canonical.present").status());
        assertEquals("INVALID", check(result, "html.link.canonical.present").details().get("state"));
    }

    @ParameterizedTest @ValueSource(strings = {"garbage", "width=banana", "initial-scale=NaN", "width=0"})
    void unusableViewportNeverPasses(String value) {
        var result = html("<meta name=viewport content='" + value + "'>");
        assertEquals(AuditStatus.WARN, check(result, "html.meta.viewport.present").status());
        assertEquals("INVALID", check(result, "html.meta.viewport.present").details().get("state"));
    }

    @Test
    void emptyDecorativeAltAndEmptyHrefRemainPresentAttributes() {
        var result = html("<img alt=''><img ALT><a href=''>current page</a>");
        assertEquals(0, result.data().get("imgAltMissingCount"));
        assertEquals(0, result.data().get("anchorNoHrefCount"));
        assertEquals(AuditStatus.PASS, check(result, "html.images.alt_coverage").status());
        assertEquals(AuditStatus.PASS, check(result, "html.anchors.href_coverage").status());
    }

    @Test
    void canonicalResolvesAgainstDocumentBaseWithoutFetching() {
        var result = html("<base href='https://other.example/path/'><link rel=canonical href=page>");
        assertEquals(AuditStatus.PASS, check(result, "html.link.canonical.present").status());
        assertEquals("page", check(result, "html.link.canonical.present").details().get("value"));
    }

    @Test
    void charsetRequiresExactAttributeOrContentTypeParameter() {
        var valid = html("<meta HTTP-EQUIV=Content-Type content='text/html; charset = UTF-8'>");
        assertEquals(AuditStatus.PASS, check(valid, "html.meta.charset.present").status());
        var invalid = html("<meta charset=''><meta http-equiv=Content-Type content='text/html; data-charset=utf-8'>");
        assertEquals(AuditStatus.WARN, check(invalid, "html.meta.charset.present").status());
    }

    @Test
    void shouldSignalUnavailableWhenHtmlIsMissing() {
        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), null);

        assertThrows(ModuleUnavailableException.class,
            () -> analyzer.analyze(ctx, LoggerFactory.getLogger("test")));
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

        AuditContext ctx = new AuditContext("http://example.com", "http://example.com", 0L)
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

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.h1.count") && c.status() == AuditStatus.WARN));
    }

    @Test
    void shouldWarnOnMissingAltAttributes() {
        String html = "<html><head><title>T</title></head><body><img src='a.png'><img src='b.png' alt='b'></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.images.alt_coverage") && c.status() == AuditStatus.WARN));
    }

    @Test
    void shouldWarnOnAnchorsWithoutHref() {
        String html = "<html><head><title>T</title></head><body><a>click</a><a href='/ok'>ok</a></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.anchors.href_coverage") && c.status() == AuditStatus.WARN));
    }

    @Test
    void shouldPassDoctypeAndCharsetWhenPresent() {
        String html = "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>T</title></head><body><h1>x</h1></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.doctype.html5") && c.status() == AuditStatus.PASS));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.meta.charset.present") && c.status() == AuditStatus.PASS));
    }

    @Test
    void shouldWarnWhenDoctypeAndCharsetMissing() {
        String html = "<html><head><title>T</title></head><body><h1>x</h1></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, java.util.List.of("http://x"), java.util.Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.doctype.html5") && c.status() == AuditStatus.WARN));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("html.meta.charset.present") && c.status() == AuditStatus.WARN));
    }
}
