package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests de {@link ZapModuleAnalyzer} : déduplication des alertes répétées, filtrage
 * des faux positifs (confidence=0) et conservation de la gravité maximale (issue #157).
 */
class ZapModuleAnalyzerTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AuditContext ctx() {
        return new AuditContext("https://example.com", "https://example.com", 1L);
    }

    private static AuditModuleResult analyze(String json) throws Exception {
        ZapClient client = mock(ZapClient.class);
        when(client.getAlerts(anyString())).thenReturn(MAPPER.readTree(json));
        return new ZapModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
    }

    private static Optional<AuditCheckResult> check(AuditModuleResult result, String key) {
        return result.checks().stream().filter(c -> key.equals(c.key())).findFirst();
    }

    @Test
    void deduplicatesRepeatedAlertsAndCountsInstances() throws Exception {
        // Même alerte (pluginId inconnu) sur 2 URLs => un seul finding, 2 occurrences.
        String json = "{\"alerts\":["
            + "{\"pluginId\":\"90001\",\"alert\":\"Info Leak\",\"riskcode\":\"2\",\"confidence\":\"2\",\"url\":\"https://example.com/a\"},"
            + "{\"pluginId\":\"90001\",\"alert\":\"Info Leak\",\"riskcode\":\"2\",\"confidence\":\"2\",\"url\":\"https://example.com/b\"}]}";
        AuditModuleResult result = analyze(json);

        AuditCheckResult finding = check(result, "zap.alert.90001").orElseThrow();
        assertEquals(2, finding.details().get("instances"));
        assertTrue(String.valueOf(finding.message()).contains("2 occurrences"));
        assertEquals(1, result.data().get("distinctFindings"));
        assertEquals(2, result.data().get("alertCount"));
    }

    @Test
    void filtersFalsePositives() throws Exception {
        // confidence=0 => faux positif ZAP, écarté (pas de check, compté dans data).
        String json = "{\"alerts\":["
            + "{\"pluginId\":\"90002\",\"alert\":\"Bruit\",\"riskcode\":\"2\",\"confidence\":\"0\",\"url\":\"https://example.com/x\"}]}";
        AuditModuleResult result = analyze(json);

        assertTrue(check(result, "zap.alert.90002").isEmpty());
        assertEquals(1, result.data().get("falsePositivesFiltered"));
        // Aucune alerte retenue => check informatif "aucune alerte".
        assertTrue(check(result, "zap.scan.result").isPresent());
    }

    @Test
    void keepsMaxSeverityAcrossInstances() throws Exception {
        // Deux occurrences de la même clé, risques 1 puis 3 => statut FAIL (gravité max).
        String json = "{\"alerts\":["
            + "{\"pluginId\":\"90003\",\"alert\":\"Léger\",\"riskcode\":\"1\",\"confidence\":\"2\",\"url\":\"https://example.com/a\"},"
            + "{\"pluginId\":\"90003\",\"alert\":\"Grave\",\"riskcode\":\"3\",\"confidence\":\"2\",\"url\":\"https://example.com/b\"}]}";
        AuditModuleResult result = analyze(json);

        AuditCheckResult finding = check(result, "zap.alert.90003").orElseThrow();
        assertEquals(AuditStatus.FAIL, finding.status());
        assertEquals("Grave", finding.title());
    }

    @Test
    void mapsKnownPluginToSharedSecurityKey() throws Exception {
        // pluginId 10035 => http.security.hsts (fusionné avec le module HTTP).
        String json = "{\"alerts\":["
            + "{\"pluginId\":\"10035\",\"alert\":\"HSTS manquant\",\"riskcode\":\"2\",\"confidence\":\"3\",\"url\":\"https://example.com\"}]}";
        AuditModuleResult result = analyze(json);

        assertTrue(check(result, "http.security.hsts").isPresent());
        assertTrue(check(result, "zap.alert.10035").isEmpty());
    }
}
