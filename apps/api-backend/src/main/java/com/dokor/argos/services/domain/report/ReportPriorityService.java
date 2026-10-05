package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.scoring.*;
import java.util.*;

/** Pure, versioned ranking of actions. Never recomputes a historical scoring policy. */
public final class ReportPriorityService {
    public static final String VERSION = "priority-impact-v1";
    private static final Map<String, String> OBSERVATORY_CAUSES = Map.of(
        "content-security-policy", "http.security.csp",
        "strict-transport-security", "http.security.hsts",
        "x-frame-options", "http.security.x_frame_options",
        "x-content-type-options", "http.security.x_content_type_options",
        "referrer-policy", "http.security.referrer_policy");

    public List<ReportDto.Priority> rank(AuditReportJson report, List<ReportDto.Issue> issues) {
        Map<String, AuditCheckResult> checks = new HashMap<>();
        for (var module : report.modules())
            for (var check : module.checks()) checks.put(identity(module.id(), check.key()), check);
        Map<String, ScoredCheck> scored = new HashMap<>();
        if (report.score() != null && report.score().checks() != null)
            for (var check : report.score().checks()) scored.put(identity(check.moduleId(), check.key()), check);

        Set<String> issueKeys = new HashSet<>();
        issues.forEach(issue -> issueKeys.add(issue.id()));
        Map<String, List<Candidate>> groups = new TreeMap<>();
        Map<String, SortedSet<String>> corroboratingSources = new HashMap<>();
        Map<String, SortedSet<String>> corroboratingKeys = new HashMap<>();
        for (var issue : issues) {
            var check = checks.get(identity(issue.module(), issue.id()));
            // Observatory is an aggregate, not a second fix for each already identified header.
            // Only suppress when every reported failed policy has an exact actionable counterpart.
            var covered = coveredObservatoryCauses(issue, check, issueKeys);
            if (!covered.isEmpty()) {
                for (String cause : covered) {
                    corroboratingSources.computeIfAbsent(cause, k -> new TreeSet<>()).addAll(sources(issue, check));
                    corroboratingKeys.computeIfAbsent(cause, k -> new TreeSet<>()).add(issue.id());
                }
                continue;
            }
            String cause = issue.id(); // canonical HTTP keys already unify HTTP/ZAP after CheckMerger
            var gain = contribution(report.score(), scored.get(identity(issue.module(), issue.id())), issue.categoryKey());
            String confidence = explicitConfidence(check);
            var candidate = new Candidate(issue, cause, sources(issue, check), confidence, gain);
            groups.computeIfAbsent(cause, k -> new ArrayList<>()).add(candidate);
        }

        List<Group> distinct = new ArrayList<>();
        for (var entry : groups.entrySet()) {
            var candidates = entry.getValue();
            candidates.sort(ORDER);
            var representative = candidates.getFirst();
            var sources = new TreeSet<>(corroboratingSources.getOrDefault(entry.getKey(), new TreeSet<>()));
            var keys = new TreeSet<>(corroboratingKeys.getOrDefault(entry.getKey(), new TreeSet<>()));
            candidates.forEach(candidate -> {
                sources.addAll(candidate.sources());
                keys.add(candidate.issue().id());
            });
            distinct.add(new Group(representative, List.copyOf(sources), List.copyOf(keys)));
        }
        distinct.sort(Comparator.comparing(Group::representative, ORDER));
        List<ReportDto.Priority> result = new ArrayList<>();
        for (var group : distinct.stream().limit(6).toList()) {
            var candidate = group.representative();
            var issue = candidate.issue();
            var gain = candidate.gain();
            result.add(new ReportDto.Priority(
                switch (issue.severity()) {
                    case critical -> ReportDto.Severity.critical;
                    case important -> ReportDto.Severity.important;
                    case info -> ReportDto.Severity.opportunity;
                },
                issue.title(), issue.impact(), issue.effort(), issue.id(), issue.categoryKey(),
                group.sources(), candidate.cause(), group.keys(), result.size() + 1, VERSION,
                gain.reason(), candidate.confidence(), gain.loss(), gain.domainPoints(), gain.globalPoints()));
        }
        return List.copyOf(result);
    }

    private static final Comparator<Candidate> ORDER = Comparator
        .comparingDouble((Candidate c) -> c.gain().globalPoints() == null ? 0 : c.gain().globalPoints()).reversed()
        .thenComparingInt(c -> switch (c.issue().severity()) { case critical -> 0; case important -> 1; case info -> 2; })
        .thenComparingInt(c -> switch (c.confidence()) { case "HIGH" -> 0; case "MEDIUM" -> 1; case "LOW" -> 2; default -> 3; })
        .thenComparingInt(c -> c.issue().effort() == null ? 4 : c.issue().effort().ordinal())
        .thenComparing(c -> c.issue().categoryKey())
        .thenComparing(Candidate::cause)
        .thenComparing(c -> c.issue().id())
        .thenComparing(c -> c.issue().module());

    private static Gain contribution(AuditScoreReport score, ScoredCheck check, String domain) {
        if (check == null) return new Gain(null, null, null, "SCORE_UNAVAILABLE");
        if (!check.scorable() || !Double.isFinite(check.weight()) || check.weight() <= 0)
            return new Gain(null, null, null, "NO_DIRECT_SCORE_GAIN");
        if (!Double.isFinite(check.score())) return new Gain(null, null, null, "SCORE_UNAVAILABLE");
        double loss = Math.max(0, Math.min(check.weight(), check.weight() - check.score()));
        // The first business domain in ScoreDomain enum order owns the scored contribution.
        String scoredDomain = Arrays.stream(ScoreDomain.values()).map(ScoreDomain::id)
            .filter(d -> check.tags() != null && check.tags().contains(d)).findFirst().orElse(null);
        if (!Objects.equals(domain, scoredDomain) || score.byDomain() == null || score.domainWeights() == null)
            return new Gain(loss, null, null, "SCORE_UNAVAILABLE");
        var aggregate = score.byDomain().stream().filter(d -> d.id().equals(domain)).findFirst().orElse(null);
        double weight = score.domainWeights().getOrDefault(domain, 0.0);
        if (aggregate == null || !Double.isFinite(aggregate.maxScore()) || aggregate.maxScore() <= 0
            || !Double.isFinite(weight) || weight <= 0 || weight > 1)
            return new Gain(loss, null, null, "SCORE_UNAVAILABLE");
        double points = 100 * loss / aggregate.maxScore();
        return new Gain(loss, points, points * weight, "MODELLED_SCORE_GAIN");
    }

    private static List<String> coveredObservatoryCauses(ReportDto.Issue issue, AuditCheckResult check, Set<String> issues) {
        if (!"observatory.score".equals(issue.id()) || check == null || check.details() == null
            || !(check.details().get("failedPolicies") instanceof List<?> policies) || policies.isEmpty()) return List.of();
        var causes = new TreeSet<String>();
        for (Object policy : policies) {
            String cause = OBSERVATORY_CAUSES.get(policy);
            if (cause == null || !issues.contains(cause)) return List.of();
            causes.add(cause);
        }
        return List.copyOf(causes);
    }

    private static List<String> sources(ReportDto.Issue issue, AuditCheckResult check) {
        var result = new TreeSet<String>();
        result.add(issue.module());
        if (check != null) result.addAll(check.sources());
        return List.copyOf(result);
    }

    static ReportDto.Effort explicitEffort(AuditCheckResult check) {
        Object value = check.details() == null ? null : check.details().get("estimatedEffort");
        if (!(value instanceof String text)) return null;
        try { return ReportDto.Effort.valueOf(text); } catch (IllegalArgumentException e) { return null; }
    }

    private static String explicitConfidence(AuditCheckResult check) {
        Object value = check == null || check.details() == null ? null : check.details().get("measurementConfidence");
        return value instanceof String text && Set.of("HIGH", "MEDIUM", "LOW").contains(text) ? text : "UNKNOWN";
    }
    private static String identity(String module, String key) { return module + ":" + key; }
    private record Gain(Double loss, Double domainPoints, Double globalPoints, String reason) {}
    private record Candidate(ReportDto.Issue issue, String cause, List<String> sources, String confidence, Gain gain) {}
    private record Group(Candidate representative, List<String> sources, List<String> keys) {}
}
