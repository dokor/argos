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

        // Agrégation par clé de check : ZAP émet souvent la même alerte pour plusieurs
        // URLs d'une même page. On déduplique (une issue par finding, N occurrences) et on
        // écarte les faux positifs signalés par ZAP (confidence=0) — garde-fous #157.
        Map<String, ZapFinding> byKey = new LinkedHashMap<>();
        int rawCount = 0;
        int falsePositives = 0;

        for (JsonNode alert : alerts) {
            rawCount++;
            // confidence ZAP : 0 = False Positive, 1 = Low, 2 = Medium, 3 = High.
            String confidence = textOrDefault(alert.path("confidence"), "");
            if ("0".equals(confidence)) {
                falsePositives++;
                continue;
            }
            String pluginId = textOrDefault(alert.path("pluginId"), "");
            String alertName = textOrDefault(alert.path("alert"), "Alerte inconnue");
            int risk = parseRisk(textOrDefault(alert.path("riskcode"), "0"));
            String description = textOrDefault(alert.path("description"), "");
            String alertUrl = textOrDefault(alert.path("url"), url);
            String checkKey = PLUGIN_KEY_MAP.getOrDefault(pluginId, "zap.alert." + pluginId);

            byKey.computeIfAbsent(checkKey, k -> new ZapFinding(k, pluginId))
                .addInstance(risk, alertName, description, alertUrl);
        }

        logger.info("ZAP module: {} alertes brutes, {} faux positifs écartés, {} findings distincts",
            rawCount, falsePositives, byKey.size());

        // Restitution triée par gravité décroissante.
        List<AuditCheckResult> checks = byKey.values().stream()
            .sorted(java.util.Comparator.comparingInt((ZapFinding f) -> f.maxRisk).reversed())
            .map(f -> f.toCheck(url))
            .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

        if (checks.isEmpty()) {
            checks.add(AuditCheckResult.of(
                "zap.scan.result",
                "Analyse passive OWASP ZAP",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,
                0.0,
                List.of(),
                0,
                Map.of("alertCount", 0),
                "L'analyse passive ZAP n'a détecté aucune alerte.",
                null
            ));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("url", url);
        data.put("alertCount", rawCount);
        data.put("distinctFindings", byKey.size());
        data.put("falsePositivesFiltered", falsePositives);

        String summary = "url=" + url + " alerts=" + rawCount
            + " distinct=" + byKey.size() + " fp=" + falsePositives;
        logger.info("ZAP module done: {}", summary);

        return new AuditModuleResult(moduleId(), "OWASP ZAP", summary, data, checks);
    }

    private AuditModuleResult emptyModule(String reason) {
        List<AuditCheckResult> checks = List.of(AuditCheckResult.of(
            "zap.available",
            "Disponibilité d'OWASP ZAP",
            AuditStatus.WARN,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            false,
            Map.of("reason", reason),
            "L'analyse OWASP ZAP n'a pas pu s'exécuter : " + reason,
            "Start the ZAP daemon and set ZAP_API_URL environment variable."
        ));
        return new AuditModuleResult(moduleId(), "OWASP ZAP", "zap=unavailable",
            Map.of("available", false, "reason", reason), checks);
    }

    /** Nombre maximal d'URLs affectées listées par finding (évite de gonfler le rapport). */
    private static final int MAX_URLS_PER_FINDING = 5;

    /**
     * Finding ZAP dédupliqué : agrège toutes les occurrences d'une même alerte (même clé de
     * check) rencontrées sur la page, en conservant la gravité maximale et un échantillon
     * d'URLs affectées.
     */
    private static final class ZapFinding {
        private final String key;
        private final String pluginId;
        private String name = "Alerte inconnue";
        private String description = "";
        private int maxRisk = -1;
        private int instances = 0;
        private final List<String> urls = new ArrayList<>();

        ZapFinding(String key, String pluginId) {
            this.key = key;
            this.pluginId = pluginId;
        }

        void addInstance(int risk, String name, String description, String url) {
            instances++;
            // On garde le libellé/description de l'occurrence la plus grave.
            if (risk > maxRisk) {
                this.maxRisk = risk;
                this.name = name;
                this.description = description;
            }
            if (url != null && !url.isBlank() && !urls.contains(url) && urls.size() < MAX_URLS_PER_FINDING) {
                urls.add(url);
            }
        }

        AuditCheckResult toCheck(String fallbackUrl) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("pluginId", pluginId);
            details.put("riskcode", String.valueOf(maxRisk));
            details.put("instances", instances);
            details.put("urls", urls.isEmpty() ? List.of(fallbackUrl) : urls);
            if (!description.isBlank()) details.put("description", description);

            String message = name + " détecté par l'analyse passive ZAP"
                + (instances > 1 ? " (" + instances + " occurrences)." : ".");

            return AuditCheckResult.of(
                key,
                name,
                mapRiskToStatus(maxRisk),
                mapRiskToSeverity(maxRisk),
                true,
                0.0,
                List.of(),
                String.valueOf(maxRisk),
                details,
                message,
                "Examinez et corrigez ce problème de sécurité : " + name
            );
        }
    }

    private static int parseRisk(String riskcode) {
        try {
            return Integer.parseInt(riskcode.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static AuditSeverity mapRiskToSeverity(int risk) {
        return switch (risk) {
            case 3 -> AuditSeverity.HIGH;
            case 2 -> AuditSeverity.MEDIUM;
            default -> AuditSeverity.LOW; // 0, 1
        };
    }

    private static AuditStatus mapRiskToStatus(int risk) {
        return switch (risk) {
            case 3 -> AuditStatus.FAIL;
            case 2, 1 -> AuditStatus.WARN;
            default -> AuditStatus.INFO; // 0
        };
    }

    private static String textOrDefault(JsonNode node, String defaultValue) {
        if (node == null || node.isMissingNode() || node.isNull()) return defaultValue;
        String s = node.asText();
        return (s == null || s.isBlank()) ? defaultValue : s;
    }
}
