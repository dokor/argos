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

    private final TechModuleAnalyzer analyzer = new TechModuleAnalyzer();

    @Test
    void shouldDetectWordpress() {
        String html = "<html><body><img src='/wp-content/uploads/x.png'></body></html>";

        AuditContext ctx = new AuditContext("http://x", "http://x")
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

        AuditContext ctx = new AuditContext("http://x", "http://x")
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

        AuditContext ctx = new AuditContext("http://x", "http://x")
            .withHttpResult("http://x", 200, 10, List.of("http://x"), headers, "<html/>");

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("tech.cdn.cloudflare") && Boolean.TRUE.equals(c.value())));
        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("tech.backend.hints") && c.value().toString().contains("PHP")));
    }

    @Test
    void shouldWarnWhenHtmlMissing() {
        AuditContext ctx = new AuditContext("http://x", "http://x")
            .withHttpResult("http://x", 200, 10, List.of("http://x"), Map.of(), null);

        AuditModuleResult result = analyzer.analyze(ctx, LoggerFactory.getLogger("test"));

        assertTrue(result.checks().stream().anyMatch(c -> c.key().equals("tech.html.available") && c.status() == AuditStatus.WARN));
    }
}
