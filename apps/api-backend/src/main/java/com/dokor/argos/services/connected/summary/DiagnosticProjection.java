package com.dokor.argos.services.connected.summary;

import com.dokor.argos.services.analysis.AuditOutputSanitizer;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.*;

/** Frozen read model V2: no current catalogue, raw evidence, HTML or report credentials. */
public record DiagnosticProjection(
        int version,
        boolean available,
        Long criticalCount,
        Long importantCount,
        Double coverageRatio,
        String coverageVersion,
        List<Rule> rules) {
    public record Rule(
            String key,
            String definitionVersion,
            String category,
            List<String> provenance,
            String outcome,
            String reason,
            String severity,
            String title,
            String impact,
            String recommendation,
            boolean evidenceAvailable) {}

    public static DiagnosticProjection unknown() {
        return new DiagnosticProjection(2, false, null, null, null, null, List.of());
    }

    public static DiagnosticProjection from(JsonNode report, JsonNode score) {
        return canonical(report, weighted(report, score));
    }

    /** Same population as the reader: report.issues, first occurrence of each ID, including zero-weight details. */
    public static DiagnosticProjection canonical(JsonNode report, DiagnosticProjection weighted) {
        if (report == null || !report.path("issues").isArray()) return unknown();
        var findings = CanonicalFindings.from(report);
        var rules = new ArrayList<Rule>(weighted.rules());
        for (var issue : findings) {
            String key = issue.path("id").asText("");
            if (key.isBlank() || key.length() > 200 || key.chars().anyMatch(Character::isISOControl)) continue;
            String category = CanonicalFindings.category(issue);
            if (!Set.of("security", "performance", "seo", "a11y").contains(category)) continue;
            if (!Set.of("critical", "important", "info").contains(issue.path("severity").asText())) continue;
            String module = issue.path("module").asText("");
            String definition = HexFormat.of().formatHex(new TokenService().sha256("published-finding-v2|" + report.path("scores").path("calculation").path("scoringVersion").asText("unknown")
                + "|" + report.path("scores").path("calculation").path("scoringFingerprint").asText("unknown")
                + "|" + category + "|" + module + "|" + key));
            // Keep frozen coverage definitions for comparisons, while using the reader's canonical severity/text.
            var existing = rules.stream().filter(r -> r.key().equals(key)).findFirst().orElse(null);
            if (existing != null) {
                if (!"FAIL".equals(existing.outcome())) continue;
                definition = existing.definitionVersion(); rules.removeIf(r -> r.key().equals(key));
            }
            rules.add(new Rule(key, definition, category, module.matches("[a-z0-9_-]{1,32}") ? List.of(module) : List.of(),
                "FAIL", null, issue.path("severity").asText().toUpperCase(Locale.ROOT), text(issue, "title", 512),
                text(issue, "impact", 1000), text(issue, "recommendation", 1000), hasEvidence(issue)));
        }
        rules.sort(Comparator.comparing(Rule::key));
        return new DiagnosticProjection(2, true,
            findings.stream().filter(i -> "critical".equals(i.path("severity").asText())).count(),
            findings.stream().filter(i -> "important".equals(i.path("severity").asText())).count(),
            weighted.coverageRatio(), weighted.coverageVersion(), List.copyOf(rules));
    }

    private static DiagnosticProjection weighted(JsonNode report, JsonNode score) {
        if (report == null || score == null) return unknown();
        var coverage = report.path("scores").path("coverage");
        var calculation = report.path("scores").path("calculation");
        if (!coverage.path("checks").isArray()
                || coverage.path("checks").isEmpty()
                || coverage.path("checks").size() > 256
                || !score.path("checks").isArray()
                || score.path("checks").size() > 2048
                || !calculation.path("scoringFingerprint").isTextual()
                || calculation.path("scoringFingerprint").asText().isBlank()
                || !calculation.path("scoringVersion").isIntegralNumber()
                || !coverage.path("version").isTextual()
                || coverage.path("version").asText().length() > 64
                || !score.path("scoringFingerprint").equals(calculation.path("scoringFingerprint"))
                || score.path("scoringVersion").asInt(-1)
                        != calculation.path("scoringVersion").asInt(-2)) return unknown();
        var observations = new TreeMap<String, List<JsonNode>>();
        for (var check : coverage.path("checks")) {
            String key = check.path("key").asText("");
            if (key.isBlank()
                    || key.length() > 200
                    || key.chars().anyMatch(Character::isISOControl)
                    || !Set.of("security", "performance", "seo", "a11y")
                            .contains(check.path("domain").asText())) continue;
            if (!check.path("weight").isNumber()
                    || !Double.isFinite(check.path("weight").asDouble())
                    || check.path("weight").asDouble() <= 0) continue;
            observations.computeIfAbsent(key, k -> new ArrayList<>()).add(check);
        }
        var rules = new ArrayList<Rule>();
        for (var entry : observations.entrySet()) {
            var c = entry.getValue().getFirst();
            String key = entry.getKey(),
                    module = c.path("module").asText(""),
                    category = c.path("domain").asText();
            String identity =
                    calculation.path("scoringVersion")
                            + "|"
                            + calculation.path("scoringFingerprint").asText()
                            + "|"
                            + coverage.path("version").asText()
                            + "|"
                            + category
                            + "|"
                            + module
                            + "|"
                            + c.path("weight").asDouble();
            String definition =
                    HexFormat.of()
                            .formatHex(new TokenService().sha256("domain-rule-v1|" + identity));
            String outcome = "UNKNOWN", reason = "MISSING_OUTCOME";
            boolean ambiguous = entry.getValue().stream().anyMatch(v -> !v.equals(c));
            var states = new HashSet<String>();
            for (var scored : score.path("checks"))
                if (key.equals(scored.path("key").asText())
                        && module.equals(scored.path("moduleId").asText())
                        && scored.path("scorable").asBoolean()
                        && scored.path("weight").asDouble() == c.path("weight").asDouble())
                    states.add(scored.path("status").asText());
            var issues = new ArrayList<JsonNode>();
            for (var issue : report.path("issues"))
                if (key.equals(issue.path("id").asText())
                        && category.equals(issue.path("categoryKey").asText())
                        && module.equals(issue.path("module").asText())
                        && Set.of("critical", "important", "info")
                                .contains(issue.path("severity").asText())) issues.add(issue);
            issues.sort(
                    Comparator.comparingInt((JsonNode i) -> rank(i.path("severity").asText()))
                            .thenComparing(i -> i.path("title").asText()));
            JsonNode issue = issues.isEmpty() ? null : issues.getFirst();
            String state = c.path("state").asText();
            if (ambiguous) {
                reason = "AMBIGUOUS_DEFINITION";
            } else if (!"MEASURED".equals(state)) {
                outcome =
                        Set.of("UNAVAILABLE", "BLOCKED_BY_ANTIBOT", "NOT_APPLICABLE")
                                        .contains(state)
                                ? state
                                : "UNKNOWN";
                reason = code(c.path("reason").asText(), outcome);
            } else if ((states.contains("FAIL") || states.contains("WARN")) && issue != null) {
                outcome = "FAIL";
                reason = null;
            } else if (states.equals(Set.of("PASS")) && issue == null) {
                outcome = "PASS";
                reason = null;
            }
            var provenance = new TreeSet<String>();
            addSource(provenance, module);
            addSource(provenance, c.path("measurementModule").asText());
            for (var source : c.path("measurementSources")) addSource(provenance, source.asText());
            boolean failed = outcome.equals("FAIL");
            rules.add(
                    new Rule(
                            key,
                            definition,
                            category,
                            provenance.stream().limit(16).toList(),
                            outcome,
                            reason,
                            failed
                                    ? issue.path("severity").asText().toUpperCase(Locale.ROOT)
                                    : null,
                            failed ? text(issue, "title", 512) : null,
                            failed ? text(issue, "impact", 1000) : null,
                            failed ? text(issue, "recommendation", 1000) : null,
                            failed && issues.stream().anyMatch(DiagnosticProjection::hasEvidence)));
        }
        if (rules.isEmpty()) return unknown();
        boolean measured = rules.stream().anyMatch(r -> Set.of("PASS", "FAIL").contains(r.outcome));
        Double ratio =
                coverage.path("global").path("ratio").isNumber()
                        ? coverage.path("global").path("ratio").asDouble()
                        : null;
        if (ratio != null && (!Double.isFinite(ratio) || ratio < 0 || ratio > 1)) ratio = null;
        return new DiagnosticProjection(
                1,
                measured,
                measured ? rules.stream().filter(r -> "CRITICAL".equals(r.severity)).count() : null,
                measured
                        ? rules.stream().filter(r -> "IMPORTANT".equals(r.severity)).count()
                        : null,
                ratio,
                coverage.path("version").asText(),
                List.copyOf(rules));
    }

    private static boolean hasEvidence(JsonNode issue) {
        if (!issue.path("evidence").asText("").isBlank()) return true;
        var structured = issue.path("structuredEvidence");
        if (structured.path("measurement").path("value").isNumber()) return true;
        var observed = com.dokor.argos.services.analysis.model.ObservedEvidence.from(structured.path("observed"));
        if (observed != null && !observed.items().isEmpty()) return true;
        for (var detail : structured.path("details"))
            if (!detail.path("text").asText("").isBlank()) return true;
        return false;
    }

    public static int rank(String severity) {
        return switch (severity.toUpperCase(Locale.ROOT)) {
            case "CRITICAL" -> 0;
            case "IMPORTANT" -> 1;
            default -> 2;
        };
    }

    private static void addSource(Set<String> sources, String value) {
        if (value.matches("[a-z0-9_-]{1,32}")) sources.add(value);
    }

    private static String text(JsonNode node, String field, int max) {
        if (!node.path(field).isTextual()) return null;
        String v = AuditOutputSanitizer.text(node.path(field).asText());
        return v.substring(0, Math.min(max, v.length()));
    }

    public static String code(String value, String fallback) {
        return value != null && value.toUpperCase(Locale.ROOT).matches("[A-Z][A-Z0-9_]{0,63}")
                ? value.toUpperCase(Locale.ROOT)
                : fallback;
    }
}
