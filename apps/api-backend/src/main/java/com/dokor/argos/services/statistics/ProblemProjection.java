package com.dokor.argos.services.statistics;

import com.dokor.argos.services.analysis.scoring.MeasurementCoverageService;
import com.dokor.argos.services.analysis.scoring.ScorePolicy;
import com.dokor.argos.services.connected.summary.CanonicalFindings;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** Frozen measured catalogue checks and canonical findings; never stores source text or evidence. */
public record ProblemProjection(String fingerprint, String coverageVersion, Boolean partial, List<Check> checks) {
    public static final int VERSION = 1;
    public record Check(String key, String category, String severity) {}

    public static ProblemProjection unknown() {
        return new ProblemProjection(null, null, null, List.of());
    }

    public static ProblemProjection from(JsonNode report, ScorePolicy policy) {
        if (report == null) return unknown();
        var calculation = report.path("scores").path("calculation");
        var coverage = report.path("scores").path("coverage");
        if (!policy.fingerprint().equals(calculation.path("scoringFingerprint").asText())
            || calculation.path("scoringVersion").asInt(-1) != policy.version()
            || !MeasurementCoverageService.VERSION.equals(coverage.path("version").asText())
            || !coverage.path("checks").isArray() || coverage.path("checks").size() > 256
            || !coverage.path("provisional").isBoolean() || !report.path("issues").isArray()) return unknown();
        var ratio = coverage.path("global").path("ratio");
        if (!ratio.isNumber() || !Double.isFinite(ratio.asDouble()) || ratio.asDouble() < 0 || ratio.asDouble() > 1) return unknown();

        var expected = new TreeMap<String, ScorePolicy.ScoreRule>();
        for (String key : policy.cataloguedKeys()) {
            var rule = policy.ruleFor(null, key);
            if (rule.applicability().contributesToScore() && rule.weight() > 0
                && Set.of("performance", "security", "seo", "a11y").contains(rule.businessCategory().tag())) expected.put(key, rule);
        }
        var observations = new TreeMap<String, JsonNode>();
        for (var check : coverage.path("checks")) {
            String key = check.path("key").asText();
            var rule = expected.get(key);
            if (rule == null || !rule.businessCategory().tag().equals(check.path("domain").asText())
                || !check.path("weight").isNumber() || check.path("weight").asDouble() != rule.weight()
                || !Set.of("MEASURED", "UNAVAILABLE", "BLOCKED_BY_ANTIBOT", "NOT_APPLICABLE").contains(check.path("state").asText())) return unknown();
            var previous = observations.putIfAbsent(key, check);
            if (previous != null && !previous.equals(check)) return unknown();
        }
        if (!observations.keySet().equals(expected.keySet())) return unknown();
        var findings = new HashMap<String, JsonNode>();
        for (var issue : CanonicalFindings.from(report)) findings.put(issue.path("id").asText(), issue);
        var measured = new ArrayList<Check>();
        for (var entry : observations.entrySet()) {
            var check = entry.getValue();
            if (!"MEASURED".equals(check.path("state").asText())) continue;
            String category = check.path("domain").asText(), severity = null;
            var issue = findings.get(entry.getKey());
            if (issue != null) {
                severity = issue.path("severity").asText();
                if (!Set.of("critical", "important", "info").contains(severity)
                    || !category.equals(CanonicalFindings.category(issue))) return unknown();
            }
            measured.add(new Check(entry.getKey(), category, severity));
        }
        if (measured.isEmpty()) return unknown();
        return new ProblemProjection(policy.fingerprint(), MeasurementCoverageService.VERSION,
            coverage.path("provisional").asBoolean(), List.copyOf(measured));
    }
}
