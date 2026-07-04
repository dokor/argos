package com.dokor.argos.services.analysis.modules.ssl;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests de {@link SslLabsModuleAnalyzer} centrés sur la distinction
 * « indisponible/inconnu » (INFO, non scoré) vs « médiocre » (WARN/FAIL) - issue #100.
 */
class SslLabsModuleAnalyzerTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AuditContext ctx() {
        return new AuditContext("https://example.com", "https://example.com", 1L);
    }

    private static AuditModuleResult analyze(String json) throws Exception {
        SslLabsClient client = mock(SslLabsClient.class);
        when(client.analyze(anyString())).thenReturn(MAPPER.readTree(json));
        return new SslLabsModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
    }

    private static AuditCheckResult check(AuditModuleResult result, String key) {
        return result.checks().stream()
            .filter(c -> key.equals(c.key()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("check not found: " + key));
    }

    @Test
    void unknownGradeIsInfoNotWarn() throws Exception {
        // Pas d'endpoint => grade indisponible. "inconnu" ≠ "moyen" : doit être INFO (non scoré).
        AuditModuleResult result = analyze("{\"status\":\"READY\",\"endpoints\":[]}");

        assertEquals(AuditStatus.INFO, check(result, "ssl.grade").status());
        // Validité et expiration également indéterminées => INFO
        assertEquals(AuditStatus.INFO, check(result, "ssl.certificate.valid").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.certificate.expiry_days").status());
    }

    @Test
    void goodGradeStillPasses() throws Exception {
        AuditModuleResult result = analyze("{\"endpoints\":[{\"grade\":\"A\"}]}");
        assertEquals(AuditStatus.PASS, check(result, "ssl.grade").status());
    }

    @Test
    void mediocreGradeIsWarn() throws Exception {
        // Un grade B réel reste un signal "moyen" => WARN (distinct de l'inconnu).
        AuditModuleResult result = analyze("{\"endpoints\":[{\"grade\":\"B\"}]}");
        assertEquals(AuditStatus.WARN, check(result, "ssl.grade").status());
    }
}
