package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Singleton
public class ZapModuleAnalyzer implements AuditModuleAnalyzer {

    /** Mapping of ZAP pluginId → existing check key */
    private static final Map<String, String> PLUGIN_KEY_MAP = Map.of(
        "10098", "http.security.csp",
        "10035", "http.security.hsts",
        "10021", "http.security.x_content_type_options",
        "10020", "http.security.x_frame_options",
        "10037", "http.security.referrer_policy"
    );

    private final ZapClient client;

    @Inject
    public ZapModuleAnalyzer(ZapClient client) {
        this.client = client;
    }

    @Override
    public String moduleId() {
        return "zap";
    }

    // PAGE scope (default)

    @Override
    public AuditModuleResult analyze(AuditContext context, Logger logger) {
        String url = context.finalUrl() != null ? context.finalUrl() : context.normalizedUrl();

        logger.info("ZAP module: fetching alerts for url={}", url);

        JsonNode response;
        try {
            response = client.getAlerts(url);
        } catch (Exception e) {
            logger.warn("ZAP module: ZAP daemon unavailable url={} error={}", url, e.getMessage());
            return emptyModule("ZAP daemon unavailable: " + e.getMessage());
        }

        JsonNode alerts = response.path("alerts");
        if (!alerts.isArray()) {
            logger.warn("ZAP module: unexpected response format (no 'alerts' array)");
            return emptyModule("Unexpected ZAP response format.");
        }

        List<AuditCheckResult> checks = new ArrayList<>();
        int alertCount = 0;

        for (JsonNode alert : alerts) {
            alertCount++;
            String pluginId = textOrDefault(alert.path("pluginId"), "");
            String alertName = textOrDefault(alert.path("alert"), "Unknown alert");
            String riskcode = textOrDefault(alert.path("riskcode"), "0");
            String description = textOrDefault(alert.path("description"), "");
            String alertUrl = textOrDefault(alert.path("url"), url);

            String checkKey = PLUGIN_KEY_MAP.getOrDefault(pluginId, "zap.alert." + pluginId);
            AuditSeverity severity = mapRiskToSeverity(riskcode);
            AuditStatus status = mapRiskToStatus(riskcode);

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("pluginId", pluginId);
            details.put("riskcode", riskcode);
            details.put("url", alertUrl);
            if (!description.isBlank()) details.put("description", description);

            checks.add(AuditCheckResult.of(
                checkKey,
                alertName,
                status,
                severity,
                true,
                0.0,
                List.of(),
                riskcode,
                details,
                alertName + " detected by ZAP passive scan.",
                "Review and remediate the security issue: " + alertName
            ));
        }

        if (checks.isEmpty()) {
            checks.add(AuditCheckResult.of(
                "zap.scan.result",
                "ZAP passive scan result",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,
                0.0,
                List.of(),
                0,
                Map.of("alertCount", 0),
                "ZAP passive scan found no alerts.",
                null
            ));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("url", url);
        data.put("alertCount", alertCount);

        String summary = "url=" + url + " alerts=" + alertCount;
        logger.info("ZAP module done: {}", summary);

        return new AuditModuleResult(moduleId(), "OWASP ZAP", summary, data, checks);
    }

    private AuditModuleResult emptyModule(String reason) {
        List<AuditCheckResult> checks = List.of(AuditCheckResult.of(
            "zap.available",
            "OWASP ZAP availability",
            AuditStatus.WARN,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            false,
            Map.of("reason", reason),
            "OWASP ZAP analysis could not run: " + reason,
            "Start the ZAP daemon and set ZAP_API_URL environment variable."
        ));
        return new AuditModuleResult(moduleId(), "OWASP ZAP", "zap=unavailable",
            Map.of("available", false, "reason", reason), checks);
    }

    private static AuditSeverity mapRiskToSeverity(String riskcode) {
        return switch (riskcode) {
            case "3" -> AuditSeverity.HIGH;
            case "2" -> AuditSeverity.MEDIUM;
            default -> AuditSeverity.LOW; // "0", "1"
        };
    }

    private static AuditStatus mapRiskToStatus(String riskcode) {
        return switch (riskcode) {
            case "3" -> AuditStatus.FAIL;
            case "2", "1" -> AuditStatus.WARN;
            default -> AuditStatus.INFO; // "0"
        };
    }

    private static String textOrDefault(JsonNode node, String defaultValue) {
        if (node == null || node.isMissingNode() || node.isNull()) return defaultValue;
        String s = node.asText();
        return (s == null || s.isBlank()) ? defaultValue : s;
    }
}
