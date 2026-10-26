package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.services.analysis.ModuleUnavailableException;
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
    @Test void preservesEveryMatchingBodyLocationAndPeerHeaderWithoutPublishingTheirContent() throws Exception {
        var client=mock(ZapClient.class);
        when(client.analyze(org.mockito.ArgumentMatchers.any(AuditContext.class))).thenReturn(MAPPER.readTree("""
          {"alerts":[{"pluginId":"90099","risk":"Low","evidence":"private-value"},
          {"pluginId":"90098","risk":"Low","evidence":"server-version"},
          {"pluginId":"90098","risk":"Low","evidence":"engine-version"}]}
          """));
        String body="<html>\n<p>private-value</p>\n<p>private-value</p></html>";
        var context=ctx().withHttpResult("https://example.com/",200,1,java.util.List.of(),java.util.Map.of("server","server-version","x-powered-by","engine-version"),body);
        var result=new ZapModuleAnalyzer(client).analyze(context,LoggerFactory.getLogger("test"));
        var details=check(result,"zap.alert.90099").orElseThrow().details();
        assertEquals("2:4,3:4",details.get("responseBodyLocations"));
        for(String coordinate:details.get("responseBodyLocations").toString().split(",")) {
            var parts=coordinate.split(":");
            assertTrue(body.split("\n")[Integer.parseInt(parts[0])-1].substring(Integer.parseInt(parts[1])-1).startsWith("private-value"));
        }
        assertEquals("server,x-powered-by",check(result,"zap.alert.90098").orElseThrow().details().get("responseHeaders"));
        assertFalse(MAPPER.writeValueAsString(details).contains("private-value"));
    }
    @Test void alertEvidenceLocatesTheRealResponseWithoutPublishingCookieNamesOrBodyValues() throws Exception {
        var client=mock(ZapClient.class);
        when(client.analyze(org.mockito.ArgumentMatchers.any(AuditContext.class))).thenReturn(MAPPER.readTree("""
          {"alerts":[{"pluginId":"10011","risk":"Low","param":"private-session"},
           {"pluginId":"10096","risk":"Low","evidence":"1723456789"},
           {"pluginId":"10036","risk":"Low","evidence":"nginx/1.0"}]}
          """));
        var context=ctx().withHttpResult("https://example.com/",200,1,java.util.List.of(),
            java.util.Map.of("set-cookie","prefs=[redacted]; secure\nprivate-session=[redacted]; httponly","server","nginx/1.0"),
            "<html>\n<body>1723456789</body></html>");
        var result=new ZapModuleAnalyzer(client).analyze(context,LoggerFactory.getLogger("test"));
        assertEquals(java.util.Set.of(2),check(result,"zap.alert.10011").orElseThrow().details().get("cookieIndexes"));
        var timestamp=check(result,"zap.alert.10096").orElseThrow();
        assertEquals(2L,timestamp.details().get("responseBodyLine"));
        assertEquals(7,timestamp.details().get("responseBodyColumn"));
        assertEquals("server",check(result,"zap.alert.10036").orElseThrow().details().get("responseHeader"));
        assertFalse(MAPPER.writeValueAsString(timestamp.details()).contains("1723456789"));
        assertFalse(MAPPER.writeValueAsString(check(result,"zap.alert.10011").orElseThrow().details()).contains("private-session"));
    }
    @Test void acceptsRealCoreApiRiskLabelsAndRetainsEachCspReason() throws Exception {
        var result = analyze("""
          {"alerts":[{"pluginId":"10055","alert":"CSP: Wildcard Directive","risk":"Medium","confidence":"High","other":"script-src-elem is missing."},
          {"pluginId":"10055","alert":"CSP: style-src unsafe-inline","risk":"Medium","confidence":"High","other":"style-src includes unsafe-inline."},
          {"pluginId":"10037","risk":"Low","confidence":"Medium"},
          {"pluginId":"90001","risk":"High","confidence":"False Positive"}]}
          """);
        var csp = check(result,"zap.alert.10055").orElseThrow();
        assertEquals(AuditStatus.WARN,csp.status());
        assertEquals("HIGH",csp.details().get("measurementConfidence"));
        assertTrue(csp.details().get("policyFindings").toString().contains("script-src-elem"));
        assertTrue(csp.details().get("policyFindings").toString().contains("unsafe-inline"));
        assertEquals(AuditStatus.WARN,check(result,"zap.alert.10037").orElseThrow().status());
        assertTrue(check(result,"zap.alert.90001").isEmpty());
        assertThrows(ModuleUnavailableException.class,()->analyze("{\"alerts\":[{\"pluginId\":\"1\",\"risk\":\"unexpected\"}]}"));
    }

    @Test void resolvesTheActualReportedFormWithoutRetainingItsInputValues() throws Exception {
        var client = mock(ZapClient.class);
        when(client.analyze(org.mockito.ArgumentMatchers.any(AuditContext.class))).thenReturn(MAPPER.readTree("""
          {"alerts":[{"pluginId":"10202","risk":"Medium","confidence":"Low","evidence":"<form method='post'>","other":"No known token in [Form 2: secret-name]"}]}
          """));
        var context=ctx().withHttpResult("https://example.com/",200,1,java.util.List.of(),java.util.Map.of(),
            "<html><body><main><form method='get'></form><form method='post'><input value='private-value'></form></main></body></html>");
        var result=new ZapModuleAnalyzer(client).analyze(context,LoggerFactory.getLogger("test"));
        var check=check(result,"zap.alert.10202").orElseThrow();
        var evidence=(com.dokor.argos.services.analysis.model.ObservedEvidence)check.details().get("observed");
        String selector=evidence.items().getFirst().selector();
        var selected=org.jsoup.Jsoup.parse(context.body()).select(selector);
        assertEquals(1,selected.size());
        assertEquals("post",selected.first().attr("method"));
        assertFalse(MAPPER.writeValueAsString(evidence).contains("private-value"));
        assertFalse(MAPPER.writeValueAsString(evidence).contains("secret-name"));
    }

    @Test void retainsTheExplanationAndSolutionAsSafePlainText() throws Exception {
        var result = analyze("""
            {"alerts":[{"pluginId":"10098","alert":"CORS","riskcode":"2","confidence":"2",
              "description":"<p>Unintended readers can access the response.</p>",
              "solution":"<p>Restrict <code>Access-Control-Allow-Origin</code>.</p><script>secret</script> token=private https://user:secret@example.com/private?token=hidden"}]}
            """);
        var finding = check(result, "zap.alert.10098").orElseThrow();
        assertEquals("Unintended readers can access the response.", finding.details().get("description"));
        assertEquals(finding.recommendation(), finding.details().get("solution"));
        assertTrue(finding.recommendation().contains("Restrict Access-Control-Allow-Origin."));
        assertFalse(finding.recommendation().contains("<"));
        assertFalse(finding.recommendation().contains("private"));
        assertFalse(finding.recommendation().contains("secret"));
    }

    @Test void keepsSolutionFromTheMostSevereInstanceAndFillsMissingPeerGuidance() throws Exception {
        var result = analyze("""
            {"alerts":[
              {"pluginId":"90003","riskcode":"1","solution":"Low-risk correction"},
              {"pluginId":"90003","riskcode":"3","description":"High-risk explanation"},
              {"pluginId":"90003","riskcode":"3","solution":"High-risk correction"},
              {"pluginId":"90003","riskcode":"1","solution":"Unrelated low-risk correction"}]}
            """);
        var finding = check(result, "zap.alert.90003").orElseThrow();
        assertEquals("High-risk correction", finding.recommendation());
        assertEquals("High-risk explanation", finding.details().get("description"));
    }

    @Test void doesNotManufactureASolutionWhenTheSourceOmitsIt() throws Exception {
        var finding = check(analyze("""
            {"alerts":[{"pluginId":"90003","riskcode":"2","description":"A source description"}]}
            """), "zap.alert.90003").orElseThrow();
        assertNull(finding.recommendation());
        assertFalse(finding.details().containsKey("solution"));
    }
    @Test void corsMisconfigurationCannotOverwriteTheCspFinding() throws Exception {
        var result = analyze("""
            {"alerts":[{"pluginId":"10098","alert":"Cross-Domain Misconfiguration","riskcode":"2","confidence":"2"},
                       {"pluginId":"10038","alert":"CSP Header Not Set","riskcode":"2","confidence":"2"}]}
            """);
        assertEquals("CSP Header Not Set", check(result, "http.security.csp").orElseThrow().title());
        assertEquals("Cross-Domain Misconfiguration", check(result, "zap.alert.10098").orElseThrow().title());
        assertEquals(2, result.data().get("distinctFindings"));
    }
    @Test void poweredByDisclosureIsVisibleAndNeverBecomesReferrerPolicy() throws Exception {
        var result = analyze("""
            {"alerts":[{"pluginId":"10037","alert":"X-Powered-By disclosure","riskcode":"1","confidence":"2"}]}
            """);
        assertTrue(check(result, "http.security.referrer_policy").isEmpty());
        var policy = new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy();
        var enriched = new com.dokor.argos.services.analysis.scoring.ScoreEnricherService(policy)
            .enrich(java.util.List.of(result));
        var finding = check(enriched.getFirst(), "zap.alert.10037").orElseThrow();
        assertTrue(finding.scorable());
        assertEquals(0, finding.weight());
        assertTrue(finding.tags().contains("security"));
    }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AuditContext ctx() {
        return new AuditContext("https://example.com", "https://example.com", 1L);
    }

    private static AuditModuleResult analyze(String json) throws Exception {
        ZapClient client = mock(ZapClient.class);
        when(client.analyze(org.mockito.ArgumentMatchers.any(AuditContext.class))).thenReturn(MAPPER.readTree(json));
        return new ZapModuleAnalyzer(client).analyze(ctx(), LoggerFactory.getLogger("test"));
    }

    private static Optional<AuditCheckResult> check(AuditModuleResult result, String key) {
        return result.checks().stream().filter(c -> key.equals(c.key())).findFirst();
    }

    @Test
    void missingAlertsArrayIsUnavailable() {
        assertThrows(ModuleUnavailableException.class, () -> analyze("{}"));
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
