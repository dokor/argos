package com.dokor.argos.services.analysis.modules.ssl;

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
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Singleton
public class SslLabsModuleAnalyzer implements AuditModuleAnalyzer {

    private final SslLabsClient client;

    @Inject
    public SslLabsModuleAnalyzer(SslLabsClient client) {
        this.client = client;
    }

    @Override
    public String moduleId() {
        return "ssl";
    }

    @Override
    public ModuleScope scope() {
        return ModuleScope.DOMAIN;
    }

    @Override
    public AuditModuleResult analyze(AuditContext context, Logger logger) {
        String url = context.finalUrl() != null ? context.finalUrl() : context.normalizedUrl();
        String host = extractHost(url);

        if (host == null) {
            logger.warn("SSL Labs module: could not extract host from url={}", url);
            return errorModule("Could not extract host from URL: " + url);
        }

        logger.info("SSL Labs module: analyzing host={}", host);

        JsonNode result;
        try {
            result = client.analyze(host);
        } catch (Exception e) {
            logger.warn("SSL Labs module: API failed host={} error={}", host, e.getMessage());
            return errorModule("SSL Labs API unavailable: " + e.getMessage());
        }

        // Pick the best/first endpoint
        JsonNode endpoints = result.path("endpoints");
        JsonNode endpoint = endpoints.isArray() && endpoints.size() > 0 ? endpoints.get(0) : null;

        List<AuditCheckResult> checks = new ArrayList<>();

        // ssl.grade
        String grade = endpoint != null ? textOrNull(endpoint.path("grade")) : null;
        boolean hasWarnings = endpoint != null && endpoint.path("hasWarnings").asBoolean(false);

        AuditStatus gradeStatus;
        if (grade == null) {
            gradeStatus = AuditStatus.WARN;
        } else if (grade.startsWith("A")) {
            gradeStatus = AuditStatus.PASS;
        } else if ("B".equals(grade)) {
            gradeStatus = AuditStatus.WARN;
        } else {
            gradeStatus = AuditStatus.FAIL;
        }

        checks.add(AuditCheckResult.of(
            "ssl.grade",
            "SSL Labs grade",
            gradeStatus,
            gradeStatus == AuditStatus.FAIL ? AuditSeverity.HIGH
                : gradeStatus == AuditStatus.WARN ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
            true,
            0.0,
            List.of(),
            grade,
            grade != null ? Map.of("grade", grade, "hasWarnings", hasWarnings) : Map.of(),
            grade != null ? "SSL Labs grade: " + grade + (hasWarnings ? " (with warnings)" : "") : "SSL Labs grade not available.",
            gradeStatus != AuditStatus.PASS ? "Investigate SSL/TLS configuration issues flagged by SSL Labs." : null
        ));

        // ssl.certificate.valid & ssl.certificate.expiry_days
        JsonNode details = endpoint != null ? endpoint.path("details") : null;
        JsonNode cert = details != null ? details.path("cert") : null;

        int certIssues = cert != null && !cert.isMissingNode() ? cert.path("issues").asInt(0) : -1;
        long notAfterMs = cert != null && !cert.isMissingNode() ? cert.path("notAfter").asLong(0L) : 0L;

        AuditStatus certValidStatus;
        if (certIssues < 0) {
            certValidStatus = AuditStatus.WARN;
        } else {
            certValidStatus = certIssues == 0 ? AuditStatus.PASS : AuditStatus.FAIL;
        }

        checks.add(AuditCheckResult.of(
            "ssl.certificate.valid",
            "SSL certificate validity",
            certValidStatus,
            certValidStatus == AuditStatus.FAIL ? AuditSeverity.HIGH : AuditSeverity.LOW,
            true,
            0.0,
            List.of(),
            certIssues >= 0 ? certIssues == 0 : null,
            certIssues >= 0 ? Map.of("issues", certIssues) : Map.of(),
            certIssues < 0 ? "Certificate validity could not be determined."
                : certIssues == 0 ? "SSL certificate has no issues."
                : "SSL certificate has " + certIssues + " issue(s).",
            certIssues > 0 ? "Investigate and fix SSL certificate issues (chain, revocation, expiry)." : null
        ));

        // ssl.certificate.expiry_days
        if (notAfterMs > 0) {
            long nowMs = Instant.now().toEpochMilli();
            long diffMs = notAfterMs - nowMs;
            long expiryDays = diffMs / (1000L * 60 * 60 * 24);

            AuditStatus expiryStatus;
            if (expiryDays > 60) {
                expiryStatus = AuditStatus.PASS;
            } else if (expiryDays >= 15) {
                expiryStatus = AuditStatus.WARN;
            } else {
                expiryStatus = AuditStatus.FAIL;
            }

            checks.add(AuditCheckResult.of(
                "ssl.certificate.expiry_days",
                "SSL certificate expiry",
                expiryStatus,
                expiryStatus == AuditStatus.FAIL ? AuditSeverity.HIGH
                    : expiryStatus == AuditStatus.WARN ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
                true,
                0.0,
                List.of(),
                expiryDays,
                Map.of("expiryDays", expiryDays, "notAfterMs", notAfterMs),
                "SSL certificate expires in " + expiryDays + " day(s).",
                expiryDays < 60 ? "Renew the SSL certificate before it expires." : null
            ));
        } else {
            checks.add(AuditCheckResult.of(
                "ssl.certificate.expiry_days",
                "SSL certificate expiry",
                AuditStatus.WARN,
                AuditSeverity.LOW,
                false,
                0.0,
                List.of(),
                null,
                Map.of(),
                "SSL certificate expiry date not available.",
                null
            ));
        }

        // ssl.protocols.tls13 and ssl.protocols.tls12
        JsonNode protocols = details != null ? details.path("protocols") : null;
        boolean hasTls13 = false;
        boolean hasTls12 = false;

        if (protocols != null && protocols.isArray()) {
            for (JsonNode proto : protocols) {
                String name = textOrNull(proto.path("name"));
                String version = textOrNull(proto.path("version"));
                if ("TLS".equals(name) && "1.3".equals(version)) hasTls13 = true;
                if ("TLS".equals(name) && "1.2".equals(version)) hasTls12 = true;
            }
        }

        checks.add(AuditCheckResult.of(
            "ssl.protocols.tls13",
            "TLS 1.3 support",
            hasTls13 ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            true,
            0.0,
            List.of(),
            hasTls13,
            Map.of("tls13", hasTls13),
            hasTls13 ? "TLS 1.3 is supported." : "TLS 1.3 is not supported.",
            hasTls13 ? null : "Consider enabling TLS 1.3 for improved security and performance."
        ));

        checks.add(AuditCheckResult.of(
            "ssl.protocols.tls12",
            "TLS 1.2 support",
            hasTls12 ? AuditStatus.PASS : AuditStatus.FAIL,
            hasTls12 ? AuditSeverity.LOW : AuditSeverity.HIGH,
            true,
            0.0,
            List.of(),
            hasTls12,
            Map.of("tls12", hasTls12),
            hasTls12 ? "TLS 1.2 is supported." : "TLS 1.2 is not supported.",
            hasTls12 ? null : "TLS 1.2 must be supported for broad client compatibility."
        ));

        // http.security.hsts — reuses existing key, will be merged by CheckMergerService
        JsonNode hstsPolicy = details != null ? details.path("hstsPolicy") : null;
        String hstsStatus = hstsPolicy != null && !hstsPolicy.isMissingNode()
            ? textOrNull(hstsPolicy.path("status")) : null;
        long hstsMaxAge = hstsPolicy != null && !hstsPolicy.isMissingNode()
            ? hstsPolicy.path("maxAge").asLong(0L) : 0L;
        boolean hstsPresent = "present".equalsIgnoreCase(hstsStatus);

        checks.add(AuditCheckResult.of(
            "http.security.hsts",
            "HSTS (Strict-Transport-Security)",
            hstsPresent ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.MEDIUM,
            true,
            0.0,
            List.of(),
            hstsPresent,
            buildHstsDetails(hstsStatus, hstsMaxAge),
            hstsPresent ? "HSTS is present (max-age=" + hstsMaxAge + ")." : "HSTS is not present.",
            hstsPresent ? null : "Enable HSTS to enforce HTTPS connections."
        ));

        // Build data
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("host", host);
        data.put("status", textOrNull(result.path("status")));
        data.put("grade", grade);
        data.put("hasWarnings", hasWarnings);
        data.put("tls13", hasTls13);
        data.put("tls12", hasTls12);
        data.put("certIssues", certIssues >= 0 ? certIssues : null);
        data.put("hstsPresent", hstsPresent);

        String summary = "host=" + host + " grade=" + grade + " tls13=" + hasTls13 + " tls12=" + hasTls12;
        logger.info("SSL Labs module done: {}", summary);

        return new AuditModuleResult(moduleId(), "SSL Labs", summary, data, checks);
    }

    private AuditModuleResult errorModule(String reason) {
        List<AuditCheckResult> checks = List.of(AuditCheckResult.of(
            "ssl.available",
            "SSL Labs availability",
            AuditStatus.WARN,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            false,
            Map.of("reason", reason),
            "SSL Labs analysis could not run: " + reason,
            "Ensure network access to api.ssllabs.com is available."
        ));
        return new AuditModuleResult(moduleId(), "SSL Labs", "ssl=unavailable",
            Map.of("available", false, "reason", reason), checks);
    }

    private static String extractHost(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            return URI.create(url).getHost();
        } catch (Exception e) {
            return null;
        }
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String s = node.asText();
        return (s == null || s.isBlank() || "null".equals(s)) ? null : s;
    }

    private static Map<String, Object> buildHstsDetails(String status, long maxAge) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (status != null) m.put("status", status);
        if (maxAge > 0) m.put("maxAge", maxAge);
        return m;
    }
}
