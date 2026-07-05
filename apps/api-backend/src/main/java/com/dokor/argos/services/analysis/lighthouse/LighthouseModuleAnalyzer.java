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
            String message = timeout
                ? "Lighthouse indisponible : délai d'attente dépassé (timeout)."
                : "Impossible d'exécuter Lighthouse (service indisponible).";
            return unavailable(reason, String.valueOf(e.getMessage()), message);
        }

        long durationMs = System.currentTimeMillis() - start;

        // Scores de catégorie réellement fournis par Lighthouse (0..100). Une catégorie dont
        // le nœud /score est absent, null ou non numérique n'est PAS fabriquée à 0 (issue #205).
        Map<String, Integer> categoryScores = collectCategoryScores(lhr);

        // Réponse HTTP 200 mais sans aucun score exploitable (corps vide / incomplet) : on la
        // traite comme une indisponibilité plutôt que comme quatre notes de 0 qui feraient
        // chuter le score global à tort — cohérent avec le chemin d'exception (issue #205).
        if (categoryScores.isEmpty()) {
            logger.warn("LIGHTHOUSE response without usable category scores, treating as unavailable");
            return unavailable("UNAVAILABLE",
                "Réponse Lighthouse sans scores exploitables",
                "Lighthouse a répondu mais sans scores exploitables (rapport vide ou incomplet).");
        }

        List<AuditCheckResult> checks = new ArrayList<>();
        // Une note de catégorie n'est émise que si Lighthouse l'a réellement fournie :
        // pas de check scorable à 0 pour une catégorie absente de la réponse.
        categoryScores.forEach((cat, score) ->
            checks.add(scoreCheck(cat, CATEGORY_TITLES.getOrDefault(cat, cat), score)));

        // Audits individuels en échec (issue #154) : en complément des notes agrégées,
        // on remonte les points précis et actionnables (ex. « images non dimensionnées »)
        // pour transformer une note en liste de corrections concrètes.
        List<AuditCheckResult> auditChecks = buildAuditChecks(lhr, logger);
        checks.addAll(auditChecks);

        // Data payload (stocké dans report_json) — ne contient que les catégories présentes.
        Map<String, Object> scores = new LinkedHashMap<>();
        categoryScores.forEach((cat, score) -> scores.put(dataKey(cat), score));

        Map<String, Object> categoryTitles = new LinkedHashMap<>();
        for (String cat : CATEGORIES) {
            String title = textOrNull(lhr.at("/categories/" + cat + "/title"));
            if (title != null) categoryTitles.put(dataKey(cat) + "Title", title);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("available", true);
        data.put("requestedUrl", url);
        data.put("finalUrl", textOrNull(lhr.at("/finalDisplayedUrl")));
        data.put("fetchTime", textOrNull(lhr.at("/fetchTime")));
        data.put("lighthouseVersion", textOrNull(lhr.at("/lighthouseVersion")));
        data.put("scores", scores);
        data.put("categories", categoryTitles);
        data.put("durationMs", durationMs);
        data.put("auditsSurfaced", auditChecks.size());

        StringBuilder summary = new StringBuilder();
        categoryScores.forEach((cat, score) ->
            summary.append(CATEGORY_ABBREV.getOrDefault(cat, cat)).append('=').append(score).append(' '));
        summary.append("audits=").append(auditChecks.size()).append(" durationMs=").append(durationMs);

        logger.info("LIGHTHOUSE module done: {}", summary);

        return new AuditModuleResult(
            moduleId(),
            "Lighthouse",
            summary.toString(),
            data,
            checks
        );
    }

    /**
     * Résultat "Lighthouse indisponible" (mode dégradé) : un seul check {@code lighthouse.collect}
     * en WARN, <b>non scorable</b> et de poids nul, plus {@code data.available=false} et un
     * {@code reason} reconnu par {@code AuditProcessorService}. Aucun {@code lighthouse.score.*}
     * n'est émis : la panne (ou une réponse vide) ne pèse pas sur le score global.
     */
    private AuditModuleResult unavailable(String reason, String errorMsg, String message) {
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

    /** Nombre maximal d'audits individuels remontés — évite de noyer le rapport. */
    static final int MAX_AUDITS = 12;
    /** Seuls les audits réellement notés sont actionnables (on ignore informative/manual/n.a.). */
    private static final Set<String> SCORED_MODES = Set.of("binary", "numeric", "metricSavings");
    private static final String[] CATEGORIES = {"performance", "accessibility", "best-practices", "seo"};

    /** Libellés FR affichés pour les quatre notes de catégorie. */
    private static final Map<String, String> CATEGORY_TITLES = Map.of(
        "performance", "Performance",
        "accessibility", "Accessibilité",
        "best-practices", "Bonnes pratiques",
        "seo", "SEO");

    /** Abréviations utilisées dans la ligne de résumé des logs. */
    private static final Map<String, String> CATEGORY_ABBREV = Map.of(
        "performance", "perf",
        "accessibility", "a11y",
        "best-practices", "bp",
        "seo", "seo");

    /** Clés camelCase utilisées dans {@code data.scores} / {@code data.categories}. */
    private static final Map<String, String> CATEGORY_DATA_KEY = Map.of(
        "performance", "performance",
        "accessibility", "accessibility",
        "best-practices", "bestPractices",
        "seo", "seo");

    private static String dataKey(String category) {
        return CATEGORY_DATA_KEY.getOrDefault(category, category);
    }

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

    /** Scores de catégorie réellement présents dans le LHR, dans l'ordre canonique. */
    private static Map<String, Integer> collectCategoryScores(JsonNode lhr) {
        Map<String, Integer> scores = new LinkedHashMap<>();
        if (lhr == null) return scores;
        for (String cat : CATEGORIES) {
            Integer s = categoryScore100(lhr, cat);
            if (s != null) scores.put(cat, s);
        }
        return scores;
    }

    /** Note 0..100 d'une catégorie, ou {@code null} si le nœud /score est absent, null ou non numérique. */
    private static Integer categoryScore100(JsonNode lhr, String categoryKey) {
        JsonNode node = lhr.at("/categories/" + categoryKey + "/score");
        if (node == null || node.isMissingNode() || node.isNull() || !node.isNumber()) {
            return null;
        }
        double v = Math.max(0.0, Math.min(1.0, node.asDouble()));
        return (int) Math.round(v * 100.0);
    }

    private static String textOrNull(JsonNode n) {
        if (n == null || n.isMissingNode() || n.isNull()) return null;
        String s = n.asText();
        return (s == null || s.isBlank()) ? null : s;
    }
}
