package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import java.util.*;

/** Frozen result inventory. Absence of a finding is never evidence of a passed check. */
public record ReportDiagnostics(String version, Scope scope, List<Check> checks) {
    public enum State { PASSED, FINDING, UNAVAILABLE, NOT_APPLICABLE, INFORMATION }
    public record Scope(String kind, int inspectedPages, boolean entireDomain) {}
    public record Check(String key, String domain, String source, String title, State state, String findingKey) {}

    public static ReportDiagnostics from(AuditReportJson report, List<ReportDto.Issue> issues) {
        var findings = new HashMap<String, ReportDto.Issue>();
        issues.forEach(issue -> findings.put(issue.id(), issue));
        var observations = new LinkedHashMap<String, AuditCheckResult>();
        var owners = new HashMap<String, String>();
        if (report.modules() != null) for (var module : report.modules()) {
            if (module.checks() == null) continue;
            for (var check : module.checks()) {
                observations.merge(check.key(), check, AuditCheckResult::mergeWith);
                owners.putIfAbsent(check.key(), module.id());
            }
        }
        var inventory = new LinkedHashMap<String, Check>();
        var coverage = report.score() == null ? null : report.score().coverage();
        if (coverage != null && coverage.checks() != null) for (var expected : coverage.checks()) {
            var observed = observations.get(expected.key());
            var finding = findings.get(expected.key());
            State state = switch (expected.state()) {
                case UNAVAILABLE, BLOCKED_BY_ANTIBOT -> State.UNAVAILABLE;
                case NOT_APPLICABLE -> State.NOT_APPLICABLE;
                case MEASURED -> state(observed, finding);
            };
            inventory.putIfAbsent(expected.key(), new Check(expected.key(), expected.domain(),
                expected.measurementModule() == null ? expected.module() : expected.measurementModule(),
                observed == null || observed.title() == null ? null : ReportEvidence.clean(observed.title()), state,
                state == State.FINDING ? expected.key() : null));
        }
        // Include observed checks outside the weighted coverage catalogue, including successes.
        observations.forEach((key, observed) -> {
            if (inventory.containsKey(key) || !observed.scorable() && !findings.containsKey(key)) return;
            var finding = findings.get(key);
            var domain = finding == null ? observed.tags().stream()
                .filter(Set.of("performance", "security", "seo", "a11y")::contains).findFirst().orElse("unknown") : finding.categoryKey();
            var source = observed.measurementProvenance() == null ? owners.get(key) : observed.measurementProvenance().module();
            inventory.put(key, new Check(key, domain, source, observed.title() == null ? null : ReportEvidence.clean(observed.title()),
                state(observed, finding), finding == null ? null : key));
        });
        return new ReportDiagnostics("report-diagnostics-v1", new Scope("page", 1, false), List.copyOf(inventory.values()));
    }

    private static State state(AuditCheckResult observed, ReportDto.Issue finding) {
        if (finding != null) return State.FINDING;
        if (observed == null) return State.UNAVAILABLE;
        return observed.status() == com.dokor.argos.services.analysis.model.enums.AuditStatus.PASS
            ? State.PASSED : State.INFORMATION;
    }
}
