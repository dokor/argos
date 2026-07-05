package com.dokor.argos.services.analysis.modules.observatory;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests de {@link ObservatoryModuleAnalyzer} : distinction indisponibilité (INFO,
 * non scoré) vs défaut (WARN/FAIL) et scoring continu (issues #100/#156).
 */
class ObservatoryModuleAnalyzerTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AuditContext ctx() {
        return new AuditContext("https://example.com", "https://example.com", 1L);
    }

    private static AuditModuleResult analyze(String json) throws Exception {
        ObservatoryClient client = mock(ObservatoryClient.class);
        when(client.scan(anyString())).thenReturn(MAPPER.readTree(json));
        return new ObservatoryModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
    }

    private static AuditCheckResult check(AuditModuleResult result, String key) {
        return result.checks().stream()
            .filter(c -> key.equals(c.key()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("check not found: " + key));
    }

    @Test
    void unavailableScoreIsInfoNotWarn() throws Exception {
        // Pas de champ score => indisponible. Ne doit pas pénaliser le site : INFO non scoré.
        AuditModuleResult result = analyze("{\"grade\":null}");
        AuditCheckResult score = check(result, "observatory.score");
        assertEquals(AuditStatus.INFO, score.status());
        assertNull(score.scoreRatio(), "indisponible => pas de ratio de score");
    }

    @Test
    void goodScoreIsPassWithContinuousRatio() throws Exception {
        AuditModuleResult result = analyze("{\"score\":80,\"grade\":\"A\"}");
        AuditCheckResult score = check(result, "observatory.score");
        assertEquals(AuditStatus.PASS, score.status());
        assertEquals(0.80, score.scoreRatio(), 0.0001);
    }

    @Test
    void mediocreScoreIsWarnWithContinuousRatio() throws Exception {
        AuditModuleResult result = analyze("{\"score\":60,\"grade\":\"C\"}");
        AuditCheckResult score = check(result, "observatory.score");
        assertEquals(AuditStatus.WARN, score.status());
        assertEquals(0.60, score.scoreRatio(), 0.0001);
    }

    @Test
    void lowScoreIsFail() throws Exception {
        AuditModuleResult result = analyze("{\"score\":20,\"grade\":\"F\"}");
        assertEquals(AuditStatus.FAIL, check(result, "observatory.score").status());
    }

    @Test
    void failedTestsCountShownInMessage() throws Exception {
        AuditModuleResult result = analyze("{\"score\":60,\"grade\":\"C\",\"tests_passed\":8,\"tests_failed\":4,\"tests_quantity\":12}");
        String msg = check(result, "observatory.tests.passed").message();
        assertEquals("8/12 tests réussis (4 en échec).", msg);
    }

    // ─── #171 : détail actionnable des tests échoués ────────────────────────────

    private static AuditModuleResult analyzeWithTests(String scanJson, String testsJson) throws Exception {
        ObservatoryClient client = mock(ObservatoryClient.class);
        when(client.scan(anyString())).thenReturn(MAPPER.readTree(scanJson));
        when(client.tests(anyInt())).thenReturn(MAPPER.readTree(testsJson));
        return new ObservatoryModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
    }

    @Test
    void failedTestsSurfacedInRecommendationAndEvidence() throws Exception {
        String scan = "{\"score\":30,\"grade\":\"F\",\"scan_id\":123,\"details_url\":\"https://obs.example/x\"}";
        String tests = "["
            + "{\"name\":\"content-security-policy\",\"pass\":false,\"score_description\":\"CSP header not implemented\"},"
            + "{\"name\":\"strict-transport-security\",\"pass\":false,\"score_description\":\"HSTS header not implemented\"},"
            + "{\"name\":\"x-frame-options\",\"pass\":true,\"score_description\":\"X-Frame-Options present\"}"
            + "]";
        AuditModuleResult result = analyzeWithTests(scan, tests);
        AuditCheckResult score = check(result, "observatory.score");

        // La recommandation liste les tests échoués (et pas ceux qui passent) + le lien.
        String reco = score.recommendation();
        assertTrue(reco.contains("CSP header not implemented"), reco);
        assertTrue(reco.contains("HSTS header not implemented"), reco);
        assertFalse(reco.contains("X-Frame-Options present"), reco);
        assertTrue(reco.contains("https://obs.example/x"), reco);

        // L'evidence (details) porte les clés stables des politiques échouées + le lien.
        Object failed = score.details().get("failedPolicies");
        assertTrue(failed instanceof List, "failedPolicies doit être une liste");
        List<?> policies = (List<?>) failed;
        assertTrue(policies.contains("content-security-policy"));
        assertTrue(policies.contains("strict-transport-security"));
        assertFalse(policies.contains("x-frame-options"));
        assertEquals("https://obs.example/x", score.details().get("detailsUrl"));

        // Le scoring reste inchangé : observatory.score, FAIL, ratio continu 0.30.
        assertEquals(AuditStatus.FAIL, score.status());
        assertEquals(0.30, score.scoreRatio(), 0.0001);
    }

    @Test
    void testsResponseAsObjectMapIsParsed() throws Exception {
        // Forme alternative : racine objet, clé = nom du test (parsing défensif).
        String scan = "{\"score\":40,\"grade\":\"E\",\"id\":77}";
        String tests = "{\"content-security-policy\":{\"pass\":false,\"score_description\":\"CSP missing\"}}";
        AuditModuleResult result = analyzeWithTests(scan, tests);
        AuditCheckResult score = check(result, "observatory.score");
        assertTrue(((List<?>) score.details().get("failedPolicies")).contains("content-security-policy"));
        assertTrue(score.recommendation().contains("CSP missing"));
    }

    @Test
    void testsUnavailableFallsBackToGenericRecommendation() throws Exception {
        ObservatoryClient client = mock(ObservatoryClient.class);
        when(client.scan(anyString())).thenReturn(MAPPER.readTree("{\"score\":30,\"grade\":\"F\",\"scan_id\":123}"));
        when(client.tests(anyInt())).thenThrow(new RuntimeException("tests endpoint down"));

        AuditModuleResult result = new ObservatoryModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
        AuditCheckResult score = check(result, "observatory.score");

        // Repli propre : score toujours valorisé, reco générique, pas de failedPolicies.
        assertEquals(AuditStatus.FAIL, score.status());
        assertEquals(0.30, score.scoreRatio(), 0.0001);
        assertEquals("Corrigez les en-têtes et politiques de sécurité signalés par Mozilla Observatory.",
            score.recommendation());
        assertFalse(score.details().containsKey("failedPolicies"));
    }

    @Test
    void goodScoreDoesNotFetchTestsAndHasNoRecommendation() throws Exception {
        ObservatoryClient client = mock(ObservatoryClient.class);
        when(client.scan(anyString())).thenReturn(MAPPER.readTree("{\"score\":80,\"grade\":\"A\",\"scan_id\":123}"));

        AuditModuleResult result = new ObservatoryModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
        AuditCheckResult score = check(result, "observatory.score");

        assertNull(score.recommendation());
        verify(client, never()).tests(anyInt());
    }
}
