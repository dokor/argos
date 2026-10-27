package com.dokor.argos.services.analysis.modules.tech;

import com.dokor.argos.services.analysis.*;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TechModuleAnalyzerTest {
    @Test void publishesPhpRisksAsSecurityFindingsWithoutAddingScoreWeight() {
        var context = new AuditContext("https://example.com", "https://example.com", 0L)
            .withHttpResult("https://example.com", 200, 10, List.of(), Map.of("x-powered-by", "PHP/8.1.33"),
                "<link href='/wp-content/style.css'>");
        var policy = new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy();
        var modules = new com.dokor.argos.services.analysis.scoring.ScoreEnricherService(policy)
            .enrich(List.of(analyzer.analyze(context, LoggerFactory.getLogger("test"))));
        var score = new com.dokor.argos.services.analysis.scoring.ScoreService(policy).compute(policy.version(), modules);
        var internal = new com.dokor.argos.services.analysis.model.AuditReportJson(4,
            context.inputUrl(), context.normalizedUrl(), java.time.Instant.now(), Map.of(), modules, score);
        var report = new com.dokor.argos.services.domain.report.PublicReportComposer().compose(internal);
        var phpIssues = report.issues().stream().filter(i -> i.id().startsWith("tech.security.php_")).toList();
        assertEquals(2, phpIssues.size());
        assertTrue(phpIssues.stream().allMatch(i -> i.categoryKey().equals("security")));
        assertTrue(phpIssues.stream().allMatch(i -> i.structuredEvidence().details().stream()
            .anyMatch(d -> d.key().equals("phpVersion") && d.text().equals("8.1.33"))));
        assertTrue(modules.getFirst().checks().stream().filter(c -> c.key().startsWith("tech.security.php_"))
            .allMatch(c -> c.scorable() && c.weight() == 0));
    }

    @Test void reassessesPhpUsingCurrentHeadersEvenWithACachedStack() {
        var logger = LoggerFactory.getLogger("test");
        var context = new AuditContext("https://example.com", "https://example.com", 0L)
            .withHttpResult("https://example.com", 200, 10, List.of(), Map.of("x-powered-by", "PHP/7.4.33"),
                "<link href='/wp-content/style.css'>");
        var stack = analyzer.analyzeStack(context, logger);
        assertFalse(stack.data().containsKey("php"));
        assertTrue(stack.checks().stream().noneMatch(c -> c.key().startsWith("tech.security.php_")));
        var current = context.withHttpResult("https://example.com", 200, 10, List.of(),
            Map.of("x-powered-by", "PHP/8.5.12"), context.body());
        var result = analyzer.analyzeCurrentResponse(current, stack, logger);
        assertEquals("8.5.12", ((Map<?, ?>) result.data().get("php")).get("phpVersion"));
        assertTrue(result.checks().stream().filter(c -> c.key().startsWith("tech.security.php_"))
            .allMatch(c -> c.status() == AuditStatus.PASS));
    }

    // NextJsDetectorService est un détecteur pur (déterministe, sans dépendance) :
    // on utilise une vraie instance plutôt qu'un mock, qui renverrait null sur detect()
    // et ferait échouer analyzeTech (NPE sur next.isNext()).
    private final TechModuleAnalyzer analyzer = new TechModuleAnalyzer(
        new NextJsDetectorService()
    );

    @Test
    void shouldDetectWordpress() {
        String html = "<html><body><img src='/wp-content/uploads/x.png'></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, List.of("http://x"), Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        Object v = result.checks().stream()
            .filter(c -> c.key().equals("tech.cms"))
            .findFirst()
            .orElseThrow()
            .value();

        assertTrue(v.toString().contains("WordPress"));
    }

    @Test
    void shouldDetectNextJs() {
        String html = "<html><head></head><body><script id='__NEXT_DATA__'>{}</script></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, List.of("http://x"), Map.of(), html);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        Object v = result.checks().stream()
            .filter(c -> c.key().equals("tech.frontend.framework"))
            .findFirst()
            .orElseThrow()
            .value();

        assertTrue(v.toString().contains("Next.js"));
    }

    @Test
    void shouldDetectCloudflareAndServerHints() {
        Map<String, String> headers = Map.of(
            "server", "cloudflare",
            "cf-ray", "xyz",
            "x-powered-by", "PHP"
        );

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, List.of("http://x"), headers, "<html/>");

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("tech.cdn.cloudflare") && Boolean.TRUE.equals(c.value())));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("tech.backend.hints") && c.value().toString().contains("PHP")));
    }

    @Test
    void shouldMarkPartialWhenHtmlMissing() {
        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, List.of("http://x"), Map.of("server", "nginx"), null);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertEquals(Boolean.TRUE, result.data().get("partial"));
        assertTrue(result.checks().stream().noneMatch(c -> c.key().equals("tech.html.available")));
    }

    @Test
    void shouldRejectAbsentHtmlAndHeaders() {
        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, List.of("http://x"), Map.of(), null);
        assertThrows(com.dokor.argos.services.analysis.ModuleUnavailableException.class,
            () -> analyzer.analyze(ctx, LoggerFactory.getLogger("test")));
    }

    @Test
    void shouldWarnWhenServerExposesVersion() {
        Map<String, String> headers = Map.of("server", "Apache/2.4.41 (Ubuntu)", "x-powered-by", "PHP/7.4.3");

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, List.of("http://x"), headers, "<html/>");

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        var check = result.checks().stream()
            .filter(c -> c.key().equals("tech.security.version_disclosure"))
            .findFirst().orElseThrow();
        assertEquals(AuditStatus.WARN, check.status());
        assertTrue(check.value().toString().contains("Apache/2.4.41"));
        assertTrue(check.value().toString().contains("PHP/7.4.3"));
    }

    @Test
    void shouldPassWhenNoVersionExposed() {
        // "cloudflare" / "PHP" sans numéro de version => pas de divulgation.
        Map<String, String> headers = Map.of("server", "cloudflare", "x-powered-by", "PHP");

        AuditContext ctx = new AuditContext("http://x", "http://x", 0L)
            .withHttpResult("http://x", 200, 10, List.of("http://x"), headers, "<html/>");

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        var check = result.checks().stream()
            .filter(c -> c.key().equals("tech.security.version_disclosure"))
            .findFirst().orElseThrow();
        assertEquals(AuditStatus.PASS, check.status());
    }
}
