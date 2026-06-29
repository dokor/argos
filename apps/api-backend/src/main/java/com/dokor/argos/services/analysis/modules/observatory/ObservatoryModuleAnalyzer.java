package com.dokor.argos.services.analysis.modules.observatory;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.ModuleScope;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Singleton
public class ObservatoryModuleAnalyzer implements AuditModuleAnalyzer {

    private final ObservatoryClient client;

    @Inject
    public ObservatoryModuleAnalyzer(ObservatoryClient client) {
        this.client = client;
    }

    @Override
    public String moduleId() {
        return "observatory";
    }

    @Override
    public ModuleScope scope() {
        return ModuleScope.DOMAIN;
    }

    @Override
    public AuditModuleResult analyze(AuditContext context, Logger logger) {
        String url = context.finalUrl() != null ? context.finalUrl() : context.normalizedUrl();
        String hostname = extractHostname(url);

        if (hostname == null) {
            logger.warn("Observatory module: could not extract hostname from url={}", url);
            return errorModule("Could not extract hostname from URL: " + url);
        }

        logger.info("Observatory module: scanning hostname={}", hostname);

        JsonNode result;
        try {
            result = client.scan(hostname);
        } catch (Exception e) {
            logger.warn("Observatory module: API call failed hostname={} error={}", hostname, e.getMessage());
            return errorModule("Observatory API unavailable: " + e.getMessage());
        }

        // Parse score
        int score = nodeInt(result, "score", -1);
        String grade = nodeText(result, "grade");
        int testsPassed = nodeInt(result, "tests_passed", -1);
        int testsFailed = nodeInt(result, "tests_failed", -1);
        int testsQuantity = nodeInt(result, "tests_quantity", -1);

        List<AuditCheckResult> checks = new ArrayList<>();

        // observatory.score
        AuditStatus scoreStatus;
        String scoreMessage;
        if (score < 0) {
            scoreStatus = AuditStatus.WARN;
            scoreMessage = "Observatory score not available.";
        } else if (score >= 75) {
            scoreStatus = AuditStatus.PASS;
            scoreMessage = "Observatory security score is good: " + score + "/100.";
        } else if (score >= 50) {
            scoreStatus = AuditStatus.WARN;
            scoreMessage = "Observatory security score is moderate: " + score + "/100.";
        } else {
            scoreStatus = AuditStatus.FAIL;
            scoreMessage = "Observatory security score is low: " + score + "/100.";
        }
        checks.add(AuditCheckResult.of(
            "observatory.score",
            "Mozilla Observatory security score",
            scoreStatus,
            score >= 75 ? AuditSeverity.LOW : score >= 50 ? AuditSeverity.MEDIUM : AuditSeverity.HIGH,
            true,
            0.0, // weight filled later by ScoreEnricherService
            List.of(),
            score >= 0 ? score : null,
            score >= 0 ? Map.of("score", score) : Map.of(),
            scoreMessage,
            score < 75 ? "Review failing security headers and policies flagged by Mozilla Observatory." : null
        ));

        // observatory.grade
        checks.add(AuditCheckResult.of(
            "observatory.grade",
            "Mozilla Observatory grade",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            grade,
            grade != null ? Map.of("grade", grade) : Map.of(),
            grade != null ? "Observatory grade: " + grade : "Observatory grade not available.",
            null
        ));

        // observatory.tests.passed
        String testsMessage;
        if (testsPassed >= 0 && testsQuantity > 0) {
            testsMessage = testsPassed + "/" + testsQuantity + " tests passed.";
        } else {
            testsMessage = "Observatory test results not available.";
        }
        checks.add(AuditCheckResult.of(
            "observatory.tests.passed",
            "Observatory tests passed",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            testsPassed >= 0 ? testsPassed : null,
            buildTestsDetails(testsPassed, testsFailed, testsQuantity),
            testsMessage,
            null
        ));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("hostname", hostname);
        data.put("score", score >= 0 ? score : null);
        data.put("grade", grade);
        data.put("testsPassed", testsPassed >= 0 ? testsPassed : null);
        data.put("testsFailed", testsFailed >= 0 ? testsFailed : null);
        data.put("testsQuantity", testsQuantity >= 0 ? testsQuantity : null);

        String summary = "hostname=" + hostname + " score=" + (score >= 0 ? score : "n/a") + " grade=" + grade;
        logger.info("Observatory module done: {}", summary);

        return new AuditModuleResult(moduleId(), "Mozilla Observatory", summary, data, checks);
    }

    private AuditModuleResult errorModule(String reason) {
        List<AuditCheckResult> checks = List.of(AuditCheckResult.of(
            "observatory.available",
            "Mozilla Observatory availability",
            AuditStatus.WARN,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            false,
            Map.of("reason", reason),
            "Mozilla Observatory analysis could not run: " + reason,
            "Ensure network access to observatory-api.mdn.mozilla.net is available."
        ));
        return new AuditModuleResult(moduleId(), "Mozilla Observatory", "observatory=unavailable",
            Map.of("available", false, "reason", reason), checks);
    }

    private static String extractHostname(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            return URI.create(url).getHost();
        } catch (Exception e) {
            return null;
        }
    }

    private static int nodeInt(JsonNode node, String field, int defaultValue) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return defaultValue;
        return node.get(field).asInt(defaultValue);
    }

    private static String nodeText(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return null;
        String s = node.get(field).asText();
        return (s == null || s.isBlank() || "null".equals(s)) ? null : s;
    }

    private static Map<String, Object> buildTestsDetails(int passed, int failed, int quantity) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (passed >= 0) m.put("passed", passed);
        if (failed >= 0) m.put("failed", failed);
        if (quantity >= 0) m.put("quantity", quantity);
        return m;
    }
}
