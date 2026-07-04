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
        // Score indisponible (API Observatory KO/en cours) => INFO non scoré : une
        // indisponibilité externe ne doit pas être interprétée comme un défaut du site
        // (le status INFO est mis à poids 0 par ScoreEnricherService). Cf. issue #100/#156.
        AuditStatus scoreStatus;
        String scoreMessage;
        if (score < 0) {
            scoreStatus = AuditStatus.INFO;
            scoreMessage = "Score Observatory indisponible.";
        } else if (score >= 75) {
            scoreStatus = AuditStatus.PASS;
            scoreMessage = "Score de sécurité Observatory bon : " + score + "/100.";
        } else if (score >= 50) {
            scoreStatus = AuditStatus.WARN;
            scoreMessage = "Score de sécurité Observatory moyen : " + score + "/100.";
        } else {
            scoreStatus = AuditStatus.FAIL;
            scoreMessage = "Score de sécurité Observatory faible : " + score + "/100.";
        }
        AuditCheckResult scoreCheck = AuditCheckResult.of(
            "observatory.score",
            "Score de sécurité Mozilla Observatory",
            scoreStatus,
            score >= 75 ? AuditSeverity.LOW : score >= 50 ? AuditSeverity.MEDIUM : AuditSeverity.HIGH,
            true,
            0.0, // weight filled later by ScoreEnricherService
            List.of(),
            score >= 0 ? score : null,
            score >= 0 ? Map.of("score", score) : Map.of(),
            scoreMessage,
            (score >= 0 && score < 75) ? "Corrigez les en-têtes et politiques de sécurité signalés par Mozilla Observatory." : null
        );
        // Scoring continu (anti-effet de falaise, cf. #100) : le score/100 pilote le ratio,
        // au lieu du seul palier PASS/WARN/FAIL. Uniquement quand le score est disponible.
        if (score >= 0) {
            scoreCheck = scoreCheck.withScoreRatio(score / 100.0);
        }
        checks.add(scoreCheck);

        // observatory.grade
        checks.add(AuditCheckResult.of(
            "observatory.grade",
            "Note Mozilla Observatory",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            grade,
            grade != null ? Map.of("grade", grade) : Map.of(),
            grade != null ? "Note Observatory : " + grade : "Note Observatory indisponible.",
            null
        ));

        // observatory.tests.passed
        String testsMessage;
        if (testsPassed >= 0 && testsQuantity > 0) {
            testsMessage = testsPassed + "/" + testsQuantity + " tests réussis"
                + (testsFailed > 0 ? " (" + testsFailed + " en échec)." : ".");
        } else {
            testsMessage = "Résultats des tests Observatory indisponibles.";
        }
        checks.add(AuditCheckResult.of(
            "observatory.tests.passed",
            "Tests Observatory réussis",
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
            "Disponibilité de Mozilla Observatory",
            AuditStatus.WARN,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            false,
            Map.of("reason", reason),
            "L'analyse Mozilla Observatory n'a pas pu s'exécuter : " + reason,
            "Vérifiez l'accès réseau à observatory-api.mdn.mozilla.net."
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
