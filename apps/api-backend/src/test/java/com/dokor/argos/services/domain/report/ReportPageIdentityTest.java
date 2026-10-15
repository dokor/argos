package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.AuditOutputSanitizer;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class ReportPageIdentityTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void preservesPageAndRedirectIdentityAcrossThePublicationSanitizer() {
        for (String path : List.of("/", "/demo/atelier/avant.html", "/account", "/" + "section/".repeat(150))) {
            String requested = "https://argos.lelouet.fr" + path;
            var internal = new AuditReportJson(4, requested, requested, Instant.now(), Map.of(),
                List.of(new AuditModuleResult("http", "HTTP", "ok", Map.of("finalUrl", requested + "?secret=hidden"), List.of())), null);
            var report = new PublicReportComposer().compose(internal);
            var json = AuditOutputSanitizer.tree(report, mapper);
            assertEquals(requested, json.path("url").asText());
            assertEquals(requested, json.path("pageIdentity").path("destination").asText());
            assertTrue(json.path("pageIdentity").path("redirected").asBoolean());
            assertTrue(json.path("pageIdentity").path("redacted").asBoolean());
            assertFalse(json.toString().contains("hidden"));
            assertEquals("https://argos.lelouet.fr", json.path("issues").isArray() ?
                com.dokor.argos.services.domain.audit.UrlNormalizer.sanitizeForLog(requested) : "");
        }
    }

    @Test void masksCredentialsQueriesFragmentsAndSensitivePathSegments() {
        var identity = ReportPageIdentity.from("https://user:pass@example.com/demo?password=secret#token", "https://example.com/report/private-token");
        assertEquals("https://example.com/demo", identity.requested());
        assertEquals("https://example.com/report/~redacted~", identity.destination());
        assertTrue(identity.redacted());
        assertTrue(identity.redirected());
        assertEquals("https://example.com/~redacted~", ReportPageIdentity.display("https://example.com/" + "x".repeat(80)));
        assertNull(ReportPageIdentity.display("javascript:alert(1)"));
        assertEquals("https://example.com/password/~redacted~/~redacted~",
            ReportPageIdentity.display("https://example.com/password/private/continuation"));
        assertEquals("https://example.com/~redacted~",
            ReportPageIdentity.display("https://example.com/reset%2Fprivate"));
    }

    @Test void leavesGeneralEvidenceAndLogsOriginOnly() {
        var cleaned = AuditOutputSanitizer.tree(Map.of("requested", "https://example.com/private?token=secret"), mapper);
        assertEquals("https://example.com", cleaned.path("requested").asText());
        assertEquals("https://example.com", com.dokor.argos.services.domain.audit.UrlNormalizer.sanitizeForLog("https://example.com/private"));
    }
}
