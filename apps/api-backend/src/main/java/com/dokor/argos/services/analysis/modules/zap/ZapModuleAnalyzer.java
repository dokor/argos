package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.services.analysis.AuditModule;
import com.dokor.argos.services.analysis.ModuleUnavailableException;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.ObservedEvidence;
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
public class ZapModuleAnalyzer {

    /** Mapping of ZAP pluginId → existing check key */
    private static final Map<String, String> PLUGIN_KEY_MAP = Map.of(
        "10038", "http.security.csp",
        "10035", "http.security.hsts",
        "10021", "http.security.x_content_type_options",
        "10020", "http.security.x_frame_options"
    );

    private final ZapClient client;

    @Inject
    public ZapModuleAnalyzer(ZapClient client) {
        this.client = client;
    }

    public String moduleId() {
        return AuditModule.ZAP.id();
    }

    // PAGE scope (default)

    public AuditModuleResult analyze(AuditContext context, Logger logger) {
        String url = context.finalUrl() != null ? context.finalUrl() : context.normalizedUrl();

        logger.info("ZAP module: analyzing HTTP snapshot url={}", com.dokor.argos.services.domain.audit.UrlNormalizer.sanitizeForLog(url));

        JsonNode response;
        try {
            response = client.analyze(context);
        } catch (Exception e) {
            logger.warn("ZAP module: passive analysis unavailable url={} error={}",
                com.dokor.argos.services.domain.audit.UrlNormalizer.sanitizeForLog(url), e.getClass().getSimpleName());
            throw new ModuleUnavailableException("ZAP daemon unavailable", e);
        }

        if (response == null || response.isNull()) {
            throw new ModuleUnavailableException("ZAP response is empty");
        }
        JsonNode alerts = response.path("alerts");
        if (!alerts.isArray()) {
            logger.warn("ZAP module: unexpected response format (no 'alerts' array)");
            throw new ModuleUnavailableException("ZAP response has no alerts array");
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
            if ("0".equals(confidence) || "False Positive".equalsIgnoreCase(confidence)) {
                falsePositives++;
                continue;
            }
            String pluginId = textOrDefault(alert.path("pluginId"), "");
            String alertName = textOrDefault(alert.path("alert"), "Alerte inconnue");
            int risk = parseRisk(textOrDefault(alert.path("riskcode"), textOrDefault(alert.path("risk"), "")));
            if (risk < 0) throw new ModuleUnavailableException("ZAP alert has an unrecognized risk level");
            String description = plainGuidance(textOrDefault(alert.path("description"), ""));
            String solution = plainGuidance(textOrDefault(alert.path("solution"), ""));
            String alertUrl = textOrDefault(alert.path("url"), url);
            String checkKey = PLUGIN_KEY_MAP.getOrDefault(pluginId, "zap.alert." + pluginId);

            var finding = byKey.computeIfAbsent(checkKey, k -> new ZapFinding(k, pluginId));
            finding.addInstance(risk, alertName, description, solution, alertUrl, confidence);
            locateResponse(finding, context, alert);
            if ("10055".equals(pluginId) && finding.policyFindings.size() < 10)
                finding.policyFindings.add(plainGuidance(alertName + ": " + textOrDefault(alert.path("other"), "")));
            if ("10202".equals(pluginId) && finding.elements.size() < 10) {
                String selector = formSelector(context.body(), alert);
                if (selector != null) finding.elements.add(Map.of("kind", "element", "selector", selector));
            }
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
                "L'analyse passive ZAP de la réponse HTTP collectée n'a détecté aucune alerte (sans exploration du site).",
                null
            ));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("url", url);
        data.put("scope", "HTTP_SNAPSHOT");
        data.put("alertCount", rawCount);
        data.put("distinctFindings", byKey.size());
        data.put("falsePositivesFiltered", falsePositives);

        String summary = "url=" + url + " alerts=" + rawCount
            + " distinct=" + byKey.size() + " fp=" + falsePositives;
        logger.info("ZAP module done: alerts={} distinct={} fp={}", rawCount, byKey.size(), falsePositives);

        return new AuditModuleResult(moduleId(), "OWASP ZAP", summary, data, checks);
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
        private String solution = "";
        private int maxRisk = -1;
        private int instances = 0;
        private int confidenceLevel = 0;
        private final List<String> urls = new ArrayList<>();
        private final java.util.Set<String> policyFindings = new java.util.LinkedHashSet<>();
        private final List<Map<String,String>> elements = new ArrayList<>();
        private final java.util.Set<Integer> cookieIndexes = new java.util.LinkedHashSet<>();
        private final Map<String,Object> responseLocation = new LinkedHashMap<>();

        ZapFinding(String key, String pluginId) {
            this.key = key;
            this.pluginId = pluginId;
        }

        void addInstance(int risk, String name, String description, String solution, String url, String confidence) {
            instances++;
            int level = switch (confidence.toLowerCase(java.util.Locale.ROOT)) {
                case "1", "low" -> 1;
                case "2", "medium" -> 2;
                case "3", "high", "4", "confirmed" -> 3;
                default -> 0;
            };
            // On garde le libellé/description de l'occurrence la plus grave.
            if (risk > maxRisk) {
                this.maxRisk = risk;
                this.name = name;
                this.description = description;
                this.solution = solution;
                this.confidenceLevel = level;
            } else if (risk == maxRisk) {
                this.confidenceLevel = Math.min(this.confidenceLevel, level);
                if (this.description.isBlank()) this.description = description;
                if (this.solution.isBlank()) this.solution = solution;
            }
            if (url != null && !url.isBlank() && !urls.contains(url) && urls.size() < MAX_URLS_PER_FINDING) {
                urls.add(url);
            }
        }

        AuditCheckResult toCheck(String fallbackUrl) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("pluginId", pluginId);
            details.put("riskcode", String.valueOf(maxRisk));
            details.put("measurementConfidence", switch (confidenceLevel) { case 1 -> "LOW"; case 2 -> "MEDIUM"; case 3 -> "HIGH"; default -> "UNKNOWN"; });
            details.put("instances", instances);
            details.putAll(responseLocation);
            if (!cookieIndexes.isEmpty()) details.put("cookieIndexes", cookieIndexes);
            details.put("urls", urls.isEmpty() ? List.of(fallbackUrl) : urls);
            if (!description.isBlank()) details.put("description", description);
            if (!solution.isBlank()) details.put("solution", solution);
            if (!policyFindings.isEmpty()) details.put("policyFindings", String.join("\n", policyFindings));
            if (!elements.isEmpty()) details.put("observed", ObservedEvidence.from(Map.of(
                "version", "observed-evidence-v1", "source", "zap", "items", elements,
                "inspected", instances, "truncated", instances > elements.size())));

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
                solution.isBlank() ? null : solution
            );
        }
    }

    /** ZAP supplies HTML prose. Keep bounded plain text, never executable markup or credentials. */
    private static String plainGuidance(String value) {
        String bounded = value.substring(0, Math.min(value.length(), 16000));
        return com.dokor.argos.services.analysis.AuditOutputSanitizer.text(org.jsoup.Jsoup.parse(bounded).text());
    }

    private static int parseRisk(String riskcode) {
        return switch (riskcode.trim().toLowerCase(java.util.Locale.ROOT)) {
            case "0", "informational" -> 0;
            case "1", "low" -> 1;
            case "2", "medium" -> 2;
            case "3", "high" -> 3;
            default -> -1;
        };
    }

    /** Locate retained source evidence without retaining its contents, cookie names or values. */
    private static void locateResponse(ZapFinding finding, AuditContext context, JsonNode alert) {
        if (java.util.Set.of("10010", "10011", "10054").contains(finding.pluginId)) {
            String param = alert.path("param").asText();
            String[] cookies = context.headers().getOrDefault("set-cookie", "").split("\n");
            for (int i=0; i<cookies.length && finding.cookieIndexes.size()<10; i++) {
                int equals = cookies[i].indexOf('=');
                if (equals > 0 && cookies[i].substring(0,equals).trim().equals(param)) finding.cookieIndexes.add(i+1);
            }
            return;
        }
        String evidence = alert.path("evidence").asText();
        if (evidence.isBlank() || evidence.length()>512 || !finding.responseLocation.isEmpty()) return;
        for (var header : context.headers().entrySet()) {
            if (header.getKey().matches("[a-zA-Z][a-zA-Z0-9-]{0,79}") && header.getValue().contains(evidence)) {
                finding.responseLocation.put("responseHeader", header.getKey());
                return;
            }
        }
        String body = context.body();
        int offset = body == null ? -1 : body.indexOf(evidence);
        if (offset >= 0) {
            finding.responseLocation.put("responseBodyLine", 1 + body.substring(0,offset).chars().filter(c -> c=='\n').count());
            finding.responseLocation.put("responseBodyColumn", offset-body.lastIndexOf('\n',offset));
        }
    }

    /** ZAP 10202 reports a one-based form ordinal. Verify its opening tag against the
     * received document before deriving a structural selector; never publish field values/HTML. */
    private static String formSelector(String html, JsonNode alert) {
        if (html == null) return null;
        var ordinal = java.util.regex.Pattern.compile("\\[Form ([1-9][0-9]{0,3}):").matcher(alert.path("other").asText());
        if (!ordinal.find()) return null;
        var forms = org.jsoup.Jsoup.parse(html).select("form");
        int index = Integer.parseInt(ordinal.group(1)) - 1;
        if (index >= forms.size()) return null;
        var candidate = forms.get(index);
        var reported = org.jsoup.Jsoup.parseBodyFragment(alert.path("evidence").asText()).selectFirst("form");
        if (reported == null || reported.attributes().asList().stream().anyMatch(a -> !candidate.attr(a.getKey()).equals(a.getValue()))) return null;
        var segments = new java.util.LinkedList<String>();
        for (var node = candidate; node != null && !node.tagName().equals("#root"); node = node.parent())
            segments.addFirst(java.util.Set.of("html", "body").contains(node.tagName()) ? node.tagName()
                : node.tagName() + ":nth-child(" + (node.elementSiblingIndex() + 1) + ")");
        return ObservedEvidence.safeSelector(String.join(" > ", segments));
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
