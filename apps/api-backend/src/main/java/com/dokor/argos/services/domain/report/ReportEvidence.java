package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import java.net.URI;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

/** Bounded textual provenance. A score ratio is never interpreted as a duration. */
final class ReportEvidence {
    private static final Map<String, String> UNITS = Map.ofEntries(
        Map.entry("http.response_time_ms", "ms"),
        Map.entry("http.redirect.count", "count"),
        Map.entry("html.h1.count", "count"), Map.entry("html.scripts.count", "count"),
        Map.entry("html.size.bytes", "bytes"), Map.entry("html.analysis.duration_ms", "ms"),
        Map.entry("runtime.console.errors", "count"), Map.entry("runtime.js.errors", "count"),
        Map.entry("runtime.network.5xx", "count"), Map.entry("runtime.network.failed_requests", "count"),
        Map.entry("runtime.network.third_party_errors", "count"),
        Map.entry("runtime.network.request_count", "count"),
        Map.entry("runtime.network.bytes_estimated", "bytes"),
        Map.entry("runtime.analysis.duration_ms", "ms"),
        Map.entry("ssl.certificate.expiry_days", "days"), Map.entry("observatory.score", "score/100")
    );
    private static final Pattern URL = Pattern.compile("https?://[^\\s<>\\\"}\\]]+");

    static ReportDto.StructuredEvidence from(String module, AuditCheckResult check) {
        Object value = check.value();
        String unit = UNITS.get(check.key());
        if (check.key().startsWith("lighthouse.score.")) unit = "score/100";
        if (check.key().startsWith("lighthouse.audit.")) {
            // audit.value is the normalised Lighthouse score, never numericValue.
            value = check.details() == null ? null : check.details().get("numericValue");
            Object rawUnit = check.details() == null ? null : check.details().get("numericUnit");
            unit = rawUnit instanceof String s ? switch (s) {
                case "millisecond" -> "ms";
                case "byte" -> "bytes";
                case "unitless" -> "unitless";
                default -> null;
            } : null;
        }
        ReportDto.Measurement measurement = value instanceof Number n && unit != null
            && Double.isFinite(n.doubleValue()) ? new ReportDto.Measurement(n.doubleValue(), unit) : null;
        List<ReportDto.EvidenceDetail> details = check.details() == null ? List.of()
            : check.details().entrySet().stream().filter(entry -> entry.getValue() != null).limit(20)
                .map(entry -> new ReportDto.EvidenceDetail(clean(entry.getKey()), clean(entry.getValue()))).toList();
        String source = check.measurementProvenance() != null && check.measurementProvenance().module() != null
            ? check.measurementProvenance().module() : module;
        return new ReportDto.StructuredEvidence(source, measurement, details);
    }

    static String clean(Object value) {
        String text = String.valueOf(value).replaceAll("[\\p{Cntrl}\\u202a-\\u202e\\u2066-\\u2069]", " ");
        text = URL.matcher(text).replaceAll(match -> {
            try {
                URI uri = URI.create(match.group());
                if (uri.getHost() == null) return "[URL]";
                return Matcher.quoteReplacement(new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), uri.getPath(), null, null).toASCIIString());
            } catch (Exception ignored) { return "[URL]"; }
        });
        return text.substring(0, Math.min(text.length(), 4000));
    }
}
