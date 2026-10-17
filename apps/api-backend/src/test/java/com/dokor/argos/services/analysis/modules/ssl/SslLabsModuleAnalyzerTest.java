package com.dokor.argos.services.analysis.modules.ssl;

import com.dokor.argos.services.analysis.ModuleUnavailableException;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests de {@link SslLabsModuleAnalyzer} centrés sur la distinction
 * « indisponible/inconnu » (INFO, non scoré) vs « médiocre » (WARN/FAIL) - issue #100.
 */
class SslLabsModuleAnalyzerTest {
    @Test void v3CertificatesAreResolvedByLeafIdNotArrayOrder() throws Exception {
        var result = analyze("""
            {"status":"READY","certs":[
              {"id":"intermediate","issues":0,"notAfter":2050000000000},
              {"id":"leaf","issues":4,"notAfter":1000000000000}],
             "endpoints":[{"grade":"T","statusMessage":"Ready","details":{
               "certChains":[{"certIds":["leaf","intermediate"]}]}}]}
            """);
        assertEquals(AuditStatus.FAIL, check(result,"ssl.certificate.valid").status());
        assertEquals(AuditStatus.FAIL, check(result,"ssl.certificate.expiry_days").status());
        assertEquals(1000000000000L, check(result,"ssl.certificate.expiry_days").details().get("notAfterMs"));
    }

    @Test void missingV3LeafDoesNotFallBackToAnUnrelatedOrLegacyCertificate() throws Exception {
        var result = analyze("""
            {"certs":[{"id":"other","issues":0,"notAfter":2050000000000}],
             "endpoints":[{"grade":"A","details":{
               "cert":{"issues":0,"notAfter":2050000000000},
               "certChains":[{"certIds":["missing"]}]}}]}
            """);
        assertEquals(AuditStatus.INFO, check(result,"ssl.certificate.valid").status());
        assertEquals(AuditStatus.INFO, check(result,"ssl.certificate.expiry_days").status());
    }

    @Test void everyServedV3LeafContributesToCertificateHealth() throws Exception {
        var result = analyze("""
            {"certs":[{"id":"rsa","issues":0,"notAfter":2050000000000},
                      {"id":"ecdsa","issues":16,"notAfter":1000000000000}],
             "endpoints":[{"grade":"T","details":{"certChains":[
               {"certIds":["rsa"]},{"certIds":["ecdsa"]}]}}]}
            """);
        assertEquals(AuditStatus.FAIL, check(result,"ssl.certificate.valid").status());
        assertEquals(AuditStatus.FAIL, check(result,"ssl.certificate.expiry_days").status());
    }

    @Test void noSniDefaultCertificateCannotInvalidateTheAuditedHostname() throws Exception {
        for (String chains : new String[] {
            "[{\"certIds\":[\"hostname\"],\"noSni\":false},{\"certIds\":[\"default\"],\"noSni\":true}]",
            "[{\"certIds\":[\"default\"],\"noSni\":true},{\"certIds\":[\"hostname\"],\"noSni\":false}]"
        }) {
            var result = analyze("""
                {"status":"READY","certs":[
                  {"id":"hostname","issues":0,"notAfter":2050000000000},
                  {"id":"default","issues":8,"notAfter":1000000000000}],
                 "endpoints":[{"grade":"A","statusMessage":"Ready","details":{"certChains":%s}}]}
                """.formatted(chains));
            assertEquals(AuditStatus.PASS, check(result,"ssl.certificate.valid").status());
            assertEquals(0, check(result,"ssl.certificate.valid").details().get("issues"));
            assertEquals(2050000000000L, check(result,"ssl.certificate.expiry_days").details().get("notAfterMs"));
        }
    }

    @Test void healthyNoSniCertificateCannotHideAnInvalidSniCertificate() throws Exception {
        var result = analyze("""
            {"status":"READY","certs":[
              {"id":"hostname","issues":8,"notAfter":1000000000000},
              {"id":"default","issues":0,"notAfter":2050000000000}],
             "endpoints":[{"grade":"M","statusMessage":"Ready","details":{"certChains":[
               {"certIds":["hostname"],"noSni":false},{"certIds":["default"],"noSni":true}]}}]}
            """);
        assertEquals(AuditStatus.FAIL, check(result,"ssl.certificate.valid").status());
        assertEquals(AuditStatus.FAIL, check(result,"ssl.certificate.expiry_days").status());
    }

    @Test void literalIpTargetsStillEvaluateTheirNoSniCertificate() throws Exception {
        for (String target : new String[] {"https://8.8.8.8", "https://[2001:4860:4860::8888]"}) {
            for (int issues : new int[] {0, 8}) {
                var result = analyze("""
                    {"status":"READY","certs":[{"id":"leaf","issues":%d,"notAfter":2050000000000}],
                     "endpoints":[{"grade":"A","statusMessage":"Ready","details":{
                       "certChains":[{"certIds":["leaf"],"noSni":true}]}}]}
                    """.formatted(issues), target);
                assertEquals(issues == 0 ? AuditStatus.PASS : AuditStatus.FAIL,
                    check(result,"ssl.certificate.valid").status());
            }
        }
    }

    @Test void noSniOnlyOrMalformedSniMetadataCannotClaimCertificateHealth() throws Exception {
        for (String chains : new String[] {
            "[{\"certIds\":[\"leaf\"],\"noSni\":true}]",
            "[{\"certIds\":[\"leaf\"],\"noSni\":\"true\"}]",
            "[{\"certIds\":[\"leaf\"],\"noSni\":false},{\"certIds\":[\"leaf\"],\"noSni\":1}]"
        }) {
            var result = analyze("""
                {"status":"READY","certs":[{"id":"leaf","issues":0,"notAfter":2050000000000}],
                 "endpoints":[{"grade":"A","statusMessage":"Ready","details":{"certChains":%s}}]}
                """.formatted(chains));
            assertEquals(AuditStatus.INFO, check(result,"ssl.certificate.valid").status());
            assertEquals(AuditStatus.INFO, check(result,"ssl.certificate.expiry_days").status());
        }
    }

    @Test
    void literalNullGradeRemainsUnavailable() throws Exception {
        var grade = check(analyze("{\"endpoints\":[{\"grade\":\"null\"}]}"), "ssl.grade");
        assertEquals(AuditStatus.INFO, grade.status());
        org.junit.jupiter.api.Assertions.assertTrue(grade.message().startsWith("Note SSL Labs indisponible."));
        assertNull(grade.recommendation());
    }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AuditModuleResult analyze(String json) throws Exception {
        return analyze(json, "https://example.com");
    }

    private static AuditModuleResult analyze(String json, String target) throws Exception {
        SslLabsClient client = mock(SslLabsClient.class);
        when(client.analyze(anyString())).thenReturn(MAPPER.readTree(json));
        return new SslLabsModuleAnalyzer(client).analyze(new AuditContext(target, target, 1L), LoggerFactory.getLogger("test"));
    }

    private static AuditCheckResult check(AuditModuleResult result, String key) {
        return result.checks().stream()
            .filter(c -> key.equals(c.key()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("check not found: " + key));
    }

    @Test
    void emptyResponseIsUnavailable() {
        assertThrows(ModuleUnavailableException.class, () -> analyze("{}"));
    }

    @Test
    void unknownGradeIsInfoNotWarn() throws Exception {
        // Pas d'endpoint => grade indisponible. "inconnu" ≠ "moyen" : doit être INFO (non scoré).
        AuditModuleResult result = analyze("{\"status\":\"READY\",\"endpoints\":[]}");
        assertEquals(Boolean.TRUE, result.data().get("partial"));

        assertEquals(AuditStatus.INFO, check(result, "ssl.grade").status());
        // Validité et expiration également indéterminées => INFO
        assertEquals(AuditStatus.INFO, check(result, "ssl.certificate.valid").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.certificate.expiry_days").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.protocols.tls12").status());
        assertEquals(AuditStatus.INFO, check(result, "ssl.protocols.tls13").status());
        assertEquals(AuditStatus.INFO, check(result, "http.security.hsts").status());
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

    // Protocoles obsolètes (issue #155)

    @Test
    void legacyProtocolsEnabledIsFail() throws Exception {
        // TLS 1.3/1.2 actifs MAIS TLS 1.0 encore proposé => FAIL (protocole déprécié).
        AuditModuleResult result = analyze("{\"endpoints\":[{\"grade\":\"A\",\"details\":{\"protocols\":["
            + "{\"name\":\"TLS\",\"version\":\"1.3\"},"
            + "{\"name\":\"TLS\",\"version\":\"1.2\"},"
            + "{\"name\":\"TLS\",\"version\":\"1.0\"}]}}]}");
        assertEquals(AuditStatus.FAIL, check(result, "ssl.protocols.legacy_disabled").status());
    }

    @Test
    void onlyModernProtocolsIsPass() throws Exception {
        AuditModuleResult result = analyze("{\"endpoints\":[{\"grade\":\"A\",\"details\":{\"protocols\":["
            + "{\"name\":\"TLS\",\"version\":\"1.3\"},"
            + "{\"name\":\"TLS\",\"version\":\"1.2\"}]}}]}");
        assertEquals(AuditStatus.PASS, check(result, "ssl.protocols.legacy_disabled").status());
    }

    @Test
    void unknownProtocolsIsInfoNotFail() throws Exception {
        // Pas de liste de protocoles (SSL Labs incomplet) => INFO non scoré, pas FAIL.
        AuditModuleResult result = analyze("{\"endpoints\":[{\"grade\":\"A\"}]}");
        assertEquals(AuditStatus.INFO, check(result, "ssl.protocols.legacy_disabled").status());
    }
}
