package com.dokor.argos.services.analysis.lighthouse;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.util.*;

@Singleton
public class LighthouseModuleAnalyzer implements AuditModuleAnalyzer {

    private final LighthouseClient client;

    @Inject
    public LighthouseModuleAnalyzer(LighthouseClient client) {
        this.client = client;
    }

    @Override
    public String moduleId() {
        return "lighthouse";
    }

    @Override
    public AuditModuleResult analyze(AuditContext auditContext, Logger logger) {
        long start = System.currentTimeMillis();

        String url = auditContext.finalUrl() != null ? auditContext.finalUrl() : auditContext.normalizedUrl();

        JsonNode lhr;
        try {
            lhr = client.analyze(url);
        } catch (Exception e) {
            List<AuditCheckResult> checks = List.of(new AuditCheckResult(
                "lighthouse.collect",
                "Lighthouse collection",
                AuditStatus.WARN,
                AuditSeverity.MEDIUM,
                false, 0.0, List.of("lighthouse"),
                false,
                Map.of("error", e.getMessage()),
                "Impossible d'exécuter Lighthouse (service indisponible ou timeout).",
                "Vérifier que lighthouse-service est up et joignable depuis api-backend."
            ));

            return new AuditModuleResult(
                moduleId(),
                "Lighthouse",
                "lighthouse=unavailable",
                Map.of("available", false, "error", e.getMessage()),
                checks
            );
        }

        long durationMs = System.currentTimeMillis() - start;

        // Scores (0..1 -> 0..100)
        int perf = score100(lhr, "performance");
        int a11y = score100(lhr, "accessibility");
        int bp = score100(lhr, "best-practices");
        int seo = score100(lhr, "seo");

        List<AuditCheckResult> checks = new ArrayList<>();

        checks.add(scoreCheck("performance", "Performance", perf));
        checks.add(scoreCheck("accessibility", "Accessibilité", a11y));
        checks.add(scoreCheck("best-practices", "Bonnes pratiques", bp));
        checks.add(scoreCheck("seo", "SEO", seo));

        // Data payload (stocké dans report_json)
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("available", true);
        data.put("requestedUrl", url);
        data.put("finalUrl", textOrNull(lhr.at("/finalDisplayedUrl")));
        data.put("fetchTime", textOrNull(lhr.at("/fetchTime")));
        data.put("lighthouseVersion", textOrNull(lhr.at("/lighthouseVersion")));
        data.put("scores", Map.of(
            "performance", perf,
            "accessibility", a11y,
            "bestPractices", bp,
            "seo", seo
        ));
        data.put("categories", Map.of(
            "performanceTitle", textOrNull(lhr.at("/categories/performance/title")),
            "accessibilityTitle", textOrNull(lhr.at("/categories/accessibility/title")),
            "bestPracticesTitle", textOrNull(lhr.at("/categories/best-practices/title")),
            "seoTitle", textOrNull(lhr.at("/categories/seo/title"))
        ));
        data.put("durationMs", durationMs);

        String summary = "perf=" + perf + " a11y=" + a11y + " bp=" + bp + " seo=" + seo + " durationMs=" + durationMs;

        logger.info("LIGHTHOUSE module done: {}", summary);

        return new AuditModuleResult(
            moduleId(),
            "Lighthouse",
            summary,
            data,
            checks
        );
    }

    private static AuditCheckResult scoreCheck(String key, String title, int score100) {
        AuditStatus status =
            score100 >= 85 ? AuditStatus.PASS :
                score100 >= 60 ? AuditStatus.WARN :
                    AuditStatus.FAIL;

        AuditSeverity severity =
            status == AuditStatus.FAIL ? AuditSeverity.HIGH :
                status == AuditStatus.WARN ? AuditSeverity.MEDIUM :
                    AuditSeverity.LOW;

        return new AuditCheckResult(
            "lighthouse.score." + key,
            "Lighthouse " + title,
            status,
            severity,
            false, 0.0, List.of("lighthouse", key),
            score100,
            Map.of("score100", score100),
            "Score " + title + " : " + score100 + "/100",
            score100 >= 85 ? null : "Optimiser les points relevés par Lighthouse pour améliorer ce score."
        );
    }

    private static int score100(JsonNode lhr, String categoryKey) {
        double v = lhr.at("/categories/" + categoryKey + "/score").asDouble(0.0);
        v = Math.max(0.0, Math.min(1.0, v));
        return (int) Math.round(v * 100.0);
    }

    private static String textOrNull(JsonNode n) {
        if (n == null || n.isMissingNode() || n.isNull()) return null;
        String s = n.asText();
        return (s == null || s.isBlank()) ? null : s;
    }
}
