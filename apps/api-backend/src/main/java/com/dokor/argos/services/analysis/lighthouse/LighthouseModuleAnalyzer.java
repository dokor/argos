package com.dokor.argos.services.analysis.lighthouse;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.net.http.HttpTimeoutException;
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
            // module "soft fail" : on ne casse pas tout l'audit
            boolean timeout = e instanceof HttpTimeoutException;
            String reason = timeout ? "TIMEOUT" : "FAILED";
            String errorMsg = String.valueOf(e.getMessage());
            String message = timeout
                ? "Lighthouse indisponible : délai d'attente dépassé (timeout)."
                : "Impossible d'exécuter Lighthouse (service indisponible).";
            List<AuditCheckResult> checks = List.of(AuditCheckResult.of(
                "lighthouse.collect",
                "Lighthouse collection",
                AuditStatus.WARN,
                AuditSeverity.MEDIUM,
                false, 0.0, List.of("lighthouse"),
                false,
                Map.of("error", errorMsg, "reason", reason),
                message,
                "Vérifier que lighthouse-service est up et joignable depuis api-backend."
            ));

            return new AuditModuleResult(
                moduleId(),
                "Lighthouse",
                "lighthouse=unavailable(" + reason.toLowerCase(Locale.ROOT) + ")",
                Map.of("available", false, "error", errorMsg, "reason", reason),
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

        // Audits individuels en échec (issue #154) : en complément des 4 notes agrégées,
        // on remonte les points précis et actionnables (ex. « images non dimensionnées »)
        // pour transformer une note en liste de corrections concrètes.
        List<AuditCheckResult> auditChecks = buildAuditChecks(lhr, logger);
        checks.addAll(auditChecks);

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
        data.put("auditsSurfaced", auditChecks.size());

        String summary = "perf=" + perf + " a11y=" + a11y + " bp=" + bp + " seo=" + seo
            + " audits=" + auditChecks.size() + " durationMs=" + durationMs;

        logger.info("LIGHTHOUSE module done: {}", summary);

        return new AuditModuleResult(
            moduleId(),
            "Lighthouse",
            summary,
            data,
            checks
        );
    }

    /** Nombre maximal d'audits individuels remontés — évite de noyer le rapport. */
    static final int MAX_AUDITS = 12;
    /** Seuls les audits réellement notés sont actionnables (on ignore informative/manual/n.a.). */
    private static final Set<String> SCORED_MODES = Set.of("binary", "numeric", "metricSavings");
    private static final String[] CATEGORIES = {"performance", "accessibility", "best-practices", "seo"};

    private record AuditCandidate(String id, String category, int weight, double score,
                                  String title, String description) {}

    /**
     * Extrait les audits Lighthouse en échec (score &lt; 0,9), priorisés par le poids de leur
     * catégorie puis par gravité (score croissant), plafonnés à {@link #MAX_AUDITS}.
     * <p>
     * Remontés comme checks {@code lighthouse.audit.<id>} — rendus <b>scorables mais de poids
     * nul</b> par la ScorePolicy : ils apparaissent comme issues actionnables <b>sans</b>
     * peser une seconde fois dans le score (les 4 notes de catégorie portent déjà le poids
     * agrégé de Lighthouse — pas de double comptage).
     */
    private static List<AuditCheckResult> buildAuditChecks(JsonNode lhr, Logger logger) {
        JsonNode audits = lhr.at("/audits");
        if (audits == null || !audits.isObject()) return List.of();

        List<AuditCandidate> candidates = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String cat : CATEGORIES) {
            JsonNode refs = lhr.at("/categories/" + cat + "/auditRefs");
            if (refs == null || !refs.isArray()) continue;
            for (JsonNode ref : refs) {
                String id = textOrNull(ref.path("id"));
                if (id == null || seen.contains(id)) continue;
                JsonNode audit = audits.path(id);
                if (audit.isMissingNode()) continue;

                String mode = textOrNull(audit.path("scoreDisplayMode"));
                if (mode == null || !SCORED_MODES.contains(mode)) continue;

                JsonNode scoreNode = audit.path("score");
                if (scoreNode.isMissingNode() || scoreNode.isNull()) continue;
                double score = scoreNode.asDouble();
                if (score >= 0.9) continue; // audit réussi : rien à corriger

                seen.add(id);
                candidates.add(new AuditCandidate(
                    id, cat, ref.path("weight").asInt(0), score,
                    textOrNull(audit.path("title")),
                    cleanDescription(textOrNull(audit.path("description")))
                ));
            }
        }

        candidates.sort(Comparator
            .comparingInt(AuditCandidate::weight).reversed()
            .thenComparingDouble(AuditCandidate::score));

        List<AuditCheckResult> out = new ArrayList<>();
        for (AuditCandidate c : candidates) {
            if (out.size() >= MAX_AUDITS) break;
            AuditStatus status = c.score() < 0.5 ? AuditStatus.FAIL : AuditStatus.WARN;
            AuditSeverity severity = status == AuditStatus.FAIL ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;

            Map<String, Object> details = new LinkedHashMap<>();
            details.put("category", c.category());
            details.put("score", c.score());
            details.put("weight", c.weight());

            String label = c.title() != null ? c.title() : c.id();
            out.add(AuditCheckResult.of(
                "lighthouse.audit." + c.id(),
                label,
                status,
                severity,
                false, 0.0, List.of("lighthouse", c.category()),
                Math.round(c.score() * 100.0) / 100.0,
                details,
                label,
                c.description()
            ));
        }

        if (candidates.size() > out.size()) {
            logger.info("LIGHTHOUSE: {} audits en échec, {} remontés (plafond {})",
                candidates.size(), out.size(), MAX_AUDITS);
        }
        return out;
    }

    /** Retire la syntaxe markdown des liens ([texte](url) → texte) et normalise les espaces. */
    private static String cleanDescription(String desc) {
        if (desc == null) return null;
        String s = desc.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1");
        return s.replaceAll("\\s+", " ").trim();
    }

    private static AuditCheckResult scoreCheck(String key, String title, int score100) {
        // Le status (PASS/WARN/FAIL) reste dérivé de seuils pour l'AFFICHAGE (badge, priorisation
        // des issues), mais le SCORE utilise un ratio continu (score/100) attaché via
        // withScoreRatio : ainsi 59 vs 60 ne fait plus basculer tout le poids du check
        // (effet de falaise), le score varie de façon proportionnelle à la note Lighthouse.
        AuditStatus status =
            score100 >= 85 ? AuditStatus.PASS :
                score100 >= 60 ? AuditStatus.WARN :
                    AuditStatus.FAIL;

        AuditSeverity severity =
            status == AuditStatus.FAIL ? AuditSeverity.HIGH :
                status == AuditStatus.WARN ? AuditSeverity.MEDIUM :
                    AuditSeverity.LOW;

        return AuditCheckResult.of(
            "lighthouse.score." + key,
            "Lighthouse " + title,
            status,
            severity,
            false, 0.0, List.of("lighthouse", key),
            score100,
            Map.of("score100", score100),
            "Score " + title + " : " + score100 + "/100",
            score100 >= 85 ? null : "Optimiser les points relevés par Lighthouse pour améliorer ce score."
        ).withScoreRatio(score100 / 100.0);
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
