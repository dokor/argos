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

        // Grade indisponible (SSL Labs en cours, endpoint absent, erreur amont) => INFO
        // non scoré : on ne confond plus "inconnu" avec "moyen" (B=WARN). Le score n'est
        // pas pénalisé par une simple indisponibilité. Cf. issue #100 - point "SSL unknown".
        AuditStatus gradeStatus;
        if (grade == null) {
            gradeStatus = AuditStatus.INFO;
        } else if (grade.startsWith("A")) {
            gradeStatus = AuditStatus.PASS;
        } else if ("B".equals(grade)) {
            gradeStatus = AuditStatus.WARN;
        } else {
            gradeStatus = AuditStatus.FAIL;
        }

        checks.add(AuditCheckResult.of(
            "ssl.grade",
            "Note SSL Labs",
            gradeStatus,
            gradeStatus == AuditStatus.FAIL ? AuditSeverity.HIGH
                : gradeStatus == AuditStatus.WARN ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
            true,
            0.0,
            List.of(),
            grade,
            grade != null ? Map.of("grade", grade, "hasWarnings", hasWarnings) : Map.of(),
            grade != null ? "Note SSL Labs : " + grade + (hasWarnings ? " (avec avertissements)" : "") : "Note SSL Labs indisponible.",
            gradeStatus != AuditStatus.PASS ? "Corrigez la configuration SSL/TLS signalée par SSL Labs." : null
        ));

        // ssl.certificate.valid & ssl.certificate.expiry_days
        JsonNode details = endpoint != null ? endpoint.path("details") : null;
        JsonNode cert = details != null ? details.path("cert") : null;

        int certIssues = cert != null && !cert.isMissingNode() ? cert.path("issues").asInt(0) : -1;
        long notAfterMs = cert != null && !cert.isMissingNode() ? cert.path("notAfter").asLong(0L) : 0L;

        // Validité indéterminée (pas de détails de cert) => INFO non scoré plutôt que WARN :
        // "inconnu" ≠ "certificat problématique". Cf. issue #100 - point "SSL unknown".
        AuditStatus certValidStatus;
        if (certIssues < 0) {
            certValidStatus = AuditStatus.INFO;
        } else {
            certValidStatus = certIssues == 0 ? AuditStatus.PASS : AuditStatus.FAIL;
        }

        checks.add(AuditCheckResult.of(
            "ssl.certificate.valid",
            "Validité du certificat SSL",
            certValidStatus,
            certValidStatus == AuditStatus.FAIL ? AuditSeverity.HIGH : AuditSeverity.LOW,
            true,
            0.0,
            List.of(),
            certIssues >= 0 ? certIssues == 0 : null,
            certIssues >= 0 ? Map.of("issues", certIssues) : Map.of(),
            certIssues < 0 ? "Validité du certificat indéterminée."
                : certIssues == 0 ? "Le certificat SSL ne présente aucun problème."
                : "Le certificat SSL présente " + certIssues + " problème(s).",
            certIssues > 0 ? "Corrigez les problèmes du certificat SSL (chaîne, révocation, expiration)." : null
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
                "Expiration du certificat SSL",
                expiryStatus,
                expiryStatus == AuditStatus.FAIL ? AuditSeverity.HIGH
                    : expiryStatus == AuditStatus.WARN ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
                true,
                0.0,
                List.of(),
                expiryDays,
                Map.of("expiryDays", expiryDays, "notAfterMs", notAfterMs),
                "Le certificat SSL expire dans " + expiryDays + " jour(s).",
                expiryDays < 60 ? "Renouvelez le certificat SSL avant son expiration." : null
            ));
        } else {
            // Date d'expiration indisponible => INFO (inconnu), pas WARN (qui suggérerait
            // une expiration proche). Cf. issue #100 - point "SSL unknown".
            checks.add(AuditCheckResult.of(
                "ssl.certificate.expiry_days",
                "Expiration du certificat SSL",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,
                0.0,
                List.of(),
                null,
                Map.of(),
                "Date d'expiration du certificat indisponible.",
                null
            ));
        }

        // ssl.protocols.tls13, ssl.protocols.tls12 et ssl.protocols.legacy_disabled
        JsonNode protocols = details != null ? details.path("protocols") : null;
        boolean hasTls13 = false;
        boolean hasTls12 = false;
        boolean hasTls10 = false;
        boolean hasTls11 = false;
        boolean hasSsl3 = false;
        boolean hasProtocolData = protocols != null && protocols.isArray() && protocols.size() > 0;

        if (hasProtocolData) {
            for (JsonNode proto : protocols) {
                String name = textOrNull(proto.path("name"));
                String version = textOrNull(proto.path("version"));
                if ("TLS".equals(name) && "1.3".equals(version)) hasTls13 = true;
                if ("TLS".equals(name) && "1.2".equals(version)) hasTls12 = true;
                if ("TLS".equals(name) && "1.1".equals(version)) hasTls11 = true;
                if ("TLS".equals(name) && "1.0".equals(version)) hasTls10 = true;
                if ("SSL".equals(name)) hasSsl3 = true;
            }
        }

        checks.add(AuditCheckResult.of(
            "ssl.protocols.tls13",
            "Prise en charge de TLS 1.3",
            hasTls13 ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            true,
            0.0,
            List.of(),
            hasTls13,
            Map.of("tls13", hasTls13),
            hasTls13 ? "TLS 1.3 est pris en charge." : "TLS 1.3 n'est pas pris en charge.",
            hasTls13 ? null : "Activez TLS 1.3 pour améliorer la sécurité et les performances."
        ));

        checks.add(AuditCheckResult.of(
            "ssl.protocols.tls12",
            "Prise en charge de TLS 1.2",
            hasTls12 ? AuditStatus.PASS : AuditStatus.FAIL,
            hasTls12 ? AuditSeverity.LOW : AuditSeverity.HIGH,
            true,
            0.0,
            List.of(),
            hasTls12,
            Map.of("tls12", hasTls12),
            hasTls12 ? "TLS 1.2 est pris en charge." : "TLS 1.2 n'est pas pris en charge.",
            hasTls12 ? null : "TLS 1.2 doit être pris en charge pour la compatibilité avec la majorité des navigateurs."
        ));

        // ssl.protocols.legacy_disabled — présence de protocoles obsolètes (SSL 2/3, TLS 1.0/1.1).
        // Ces versions sont dépréciées (RFC 8996) et vulnérables (POODLE, BEAST…). Distinct de
        // "TLS 1.2/1.3 activés" : un serveur peut proposer 1.3 tout en gardant 1.0 actif.
        // Sans données de protocoles (SSL Labs incomplet) => INFO non scoré ("inconnu" ≠ "défaut").
        boolean hasLegacy = hasSsl3 || hasTls10 || hasTls11;
        AuditStatus legacyStatus = !hasProtocolData ? AuditStatus.INFO
            : hasLegacy ? AuditStatus.FAIL : AuditStatus.PASS;
        List<String> legacyProtos = new ArrayList<>();
        if (hasSsl3) legacyProtos.add("SSL");
        if (hasTls10) legacyProtos.add("TLS 1.0");
        if (hasTls11) legacyProtos.add("TLS 1.1");

        checks.add(AuditCheckResult.of(
            "ssl.protocols.legacy_disabled",
            "Désactivation des protocoles obsolètes",
            legacyStatus,
            legacyStatus == AuditStatus.FAIL ? AuditSeverity.HIGH : AuditSeverity.LOW,
            hasProtocolData,
            0.0,
            List.of(),
            hasProtocolData ? !hasLegacy : null,
            hasProtocolData ? Map.of("legacyEnabled", hasLegacy, "protocols", legacyProtos) : Map.of(),
            !hasProtocolData ? "Liste des protocoles TLS indisponible."
                : hasLegacy ? "Des protocoles obsolètes sont encore activés : " + String.join(", ", legacyProtos) + "."
                : "Aucun protocole obsolète (SSL, TLS 1.0/1.1) n'est activé.",
            hasLegacy ? "Désactivez SSL 2/3 et TLS 1.0/1.1 : ces versions sont dépréciées et vulnérables." : null
        ));

        // http.security.hsts - reuses existing key, will be merged by CheckMergerService
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
            hstsPresent ? "HSTS est actif (max-age=" + hstsMaxAge + ")." : "HSTS n'est pas actif.",
            hstsPresent ? null : "Activez HSTS pour forcer les connexions HTTPS."
        ));

        // Build data
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("host", host);
        data.put("status", textOrNull(result.path("status")));
        data.put("grade", grade);
        data.put("hasWarnings", hasWarnings);
        data.put("tls13", hasTls13);
        data.put("tls12", hasTls12);
        data.put("legacyProtocolsEnabled", hasProtocolData ? hasLegacy : null);
        data.put("certIssues", certIssues >= 0 ? certIssues : null);
        data.put("hstsPresent", hstsPresent);

        String summary = "host=" + host + " grade=" + grade + " tls13=" + hasTls13 + " tls12=" + hasTls12;
        logger.info("SSL Labs module done: {}", summary);

        return new AuditModuleResult(moduleId(), "SSL Labs", summary, data, checks);
    }

    private AuditModuleResult errorModule(String reason) {
        List<AuditCheckResult> checks = List.of(AuditCheckResult.of(
            "ssl.available",
            "Disponibilité de SSL Labs",
            AuditStatus.WARN,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            false,
            Map.of("reason", reason),
            "L'analyse SSL Labs n'a pas pu s'exécuter : " + reason,
            "Vérifiez l'accès réseau à api.ssllabs.com."
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
