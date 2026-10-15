package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class SecurityHeaderValidationTest {
    @Test void nonEmptyButIneffectiveValuesCannotPass() {
        Map<String, String> headers = Map.of("strict-transport-security", "max-age=0",
            "content-security-policy", "report-uri /reports", "x-content-type-options", "yes",
            "x-frame-options", "ALLOW-FROM https://example.com", "referrer-policy", "unsafe-url",
            "permissions-policy", "camera=*");
        assertTrue(HttpModuleAnalyzer.checkSecurityHeaders(headers, "https://example.com").stream()
            .allMatch(c -> c.status() == AuditStatus.WARN));
        for (String value : List.of("max-age=banana", "max-age=1; max-age=2", "max-age=\"1", "includeSubDomains"))
            assertFalse(SecurityHeaderValidation.effective("strict-transport-security", value, Map.of()), value);
    }
    @Test void hstsRequiresHttpsAndPositiveLifetime() {
        var headers = Map.of("strict-transport-security", "max-age=31536000; includeSubDomains");
        assertEquals(AuditStatus.PASS, HttpModuleAnalyzer.checkSecurityHeaders(headers, "https://example.com").getFirst().status());
        assertEquals(AuditStatus.WARN, HttpModuleAnalyzer.checkSecurityHeaders(headers, "http://example.com").getFirst().status());
    }
    @Test void cspFrameAncestorsIsAnAlternativeToXFrameOptions() {
        var headers = Map.of("content-security-policy", "default-src 'self'; frame-ancestors 'none'");
        var checks = HttpModuleAnalyzer.checkSecurityHeaders(headers, "https://example.com");
        assertEquals(AuditStatus.PASS, checks.stream().filter(c -> c.key().equals("http.security.x_frame_options")).findFirst().orElseThrow().status());
        assertTrue(SecurityHeaderValidation.effective("content-security-policy", headers.get("content-security-policy"), headers));
        assertFalse(SecurityHeaderValidation.effective("content-security-policy", "default-src 'self'; script-src * 'unsafe-inline'", Map.of()));
        assertFalse(SecurityHeaderValidation.effective("x-frame-options", null, Map.of("content-security-policy", "frame-ancestors *")));
    }
    @Test void acceptedValuesAndReferrerFallbackOrderMatchBrowserSemantics() {
        for (var header : Map.of("x-content-type-options", "NoSniff", "x-frame-options", "SAMEORIGIN",
                "referrer-policy", "unsafe-url, strict-origin", "permissions-policy", "camera=(), microphone=(self)").entrySet())
            assertTrue(SecurityHeaderValidation.effective(header.getKey(), header.getValue(), Map.of()), header.toString());
        assertFalse(SecurityHeaderValidation.effective("referrer-policy", "strict-origin, unsafe-url", Map.of()));
    }
}
