package com.dokor.argos.services.analysis.modules.observatory;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
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
}
