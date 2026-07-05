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
import java.util.Iterator;
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
        // Détail des tests échoués (en-têtes/politiques précis) pour une recommandation
        // actionnable (issue #171). On ne l'appelle que lorsque le score pose problème
        // (< 75) : inutile de solliciter l'API /tests quand tout va bien. Toute erreur
        // de cet appel secondaire est absorbée (repli sur la reco générique) : elle ne
        // doit jamais faire échouer le module ni dégrader le score.
        String detailsUrl = nodeText(result, "details_url");
        List<FailedTest> failedTests = List.of();
        if (score >= 0 && score < 75) {
            int scanId = firstInt(result, -1, "scan_id", "id");
            if (scanId >= 0) {
                try {
                    failedTests = parseFailedTests(client.tests(scanId));
                } catch (Exception e) {
                    logger.warn("Observatory module: tests detail unavailable scanId={} error={}", scanId, e.getMessage());
                }
            }
        }

        Map<String, Object> scoreDetails = new LinkedHashMap<>();
        if (score >= 0) scoreDetails.put("score", score);
        if (!failedTests.isEmpty()) {
            scoreDetails.put("failedPolicies", failedTests.stream().map(FailedTest::name).toList());
        }
        if (detailsUrl != null) scoreDetails.put("detailsUrl", detailsUrl);

        AuditCheckResult scoreCheck = AuditCheckResult.of(
            "observatory.score",
            "Score de sécurité Mozilla Observatory",
            scoreStatus,
            score >= 75 ? AuditSeverity.LOW : score >= 50 ? AuditSeverity.MEDIUM : AuditSeverity.HIGH,
            true,
            0.0, // weight filled later by ScoreEnricherService
            List.of(),
            score >= 0 ? score : null,
            scoreDetails,
            scoreMessage,
            buildScoreRecommendation(score, failedTests, detailsUrl)
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
        if (!failedTests.isEmpty()) {
            data.put("failedPolicies", failedTests.stream().map(FailedTest::name).toList());
        }

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

    /** Un test Observatory en échec : {@code name} = clé stable de la règle, {@code description} = explication lisible. */
    private record FailedTest(String name, String description) {}

    /**
     * Construit la recommandation de {@code observatory.score}. Quand des tests
     * échoués sont connus, elle liste les points précis à corriger ; sinon elle
     * reste générique. {@code null} si le score est bon (>= 75) ou indisponible.
     */
    private static String buildScoreRecommendation(int score, List<FailedTest> failedTests, String detailsUrl) {
        if (score < 0 || score >= 75) return null;
        String suffix = detailsUrl != null ? " Détails complets : " + detailsUrl : "";
        if (!failedTests.isEmpty()) {
            String items = failedTests.stream()
                .map(FailedTest::description)
                .collect(java.util.stream.Collectors.joining(" ; "));
            return "Corrigez les en-têtes/politiques de sécurité signalés par Mozilla Observatory : " + items + "." + suffix;
        }
        return "Corrigez les en-têtes et politiques de sécurité signalés par Mozilla Observatory." + suffix;
    }

    /**
     * Parse la réponse de {@code /tests} en liste des tests échoués. Parsing
     * défensif : tolère une racine tableau ou objet (clé = nom du test) et des
     * noms de champs variables ({@code name}, {@code score_description}…). Un test
     * n'est retenu comme échoué que si {@code pass == false} explicitement.
     */
    private static List<FailedTest> parseFailedTests(JsonNode node) {
        if (node == null || node.isNull()) return List.of();
        List<FailedTest> out = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode el : node) addIfFailed(el, null, out);
        } else if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                addIfFailed(e.getValue(), e.getKey(), out);
            }
        }
        return out;
    }

    private static void addIfFailed(JsonNode test, String keyName, List<FailedTest> out) {
        if (test == null || !test.isObject()) return;
        JsonNode passNode = test.get("pass");
        // Champ pass absent/null => on ne présume pas l'échec (prudence).
        boolean failed = passNode != null && !passNode.isNull() && !passNode.asBoolean(true);
        if (!failed) return;
        String name = firstText(test, "name");
        if (name == null) name = keyName;
        if (name == null) name = "test";
        String desc = firstText(test, "score_description", "description", "result");
        if (desc == null) desc = name;
        out.add(new FailedTest(name, desc));
    }

    /** Premier champ textuel non vide parmi {@code fields}, ou {@code null}. */
    private static String firstText(JsonNode node, String... fields) {
        if (node == null) return null;
        for (String f : fields) {
            String v = nodeText(node, f);
            if (v != null) return v;
        }
        return null;
    }

    /** Premier champ entier présent parmi {@code fields}, ou {@code defaultValue}. */
    private static int firstInt(JsonNode node, int defaultValue, String... fields) {
        if (node == null) return defaultValue;
        for (String f : fields) {
            if (node.has(f) && !node.get(f).isNull() && node.get(f).canConvertToInt()) {
                return node.get(f).asInt(defaultValue);
            }
        }
        return defaultValue;
    }
}
