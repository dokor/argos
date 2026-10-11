package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import java.util.*;
import static com.dokor.argos.services.analysis.scoring.MeasurementCoverage.*;

public final class MeasurementCoverageService {
    public static final String VERSION = "weighted-coverage-v3";
    public static final double THRESHOLD = 0.8;
    private MeasurementCoverageService() {}
    public static boolean antiBot(List<AuditModuleResult> modules) {
        return modules.stream().filter(m -> "http".equals(m.id())).anyMatch(m ->
            m.data() != null && Boolean.TRUE.equals(m.data().get("antiBotDetected")));
    }
    public static boolean blocked(String module, String key, boolean antiBot) {
        return antiBot && (Set.of("html", "runtime", "lighthouse", "tech").contains(module)
            || ("http".equals(module) && !Set.of("http.final_url.https", "http.redirect.count", "http.redirect.to_https").contains(key)));
    }
    public static boolean transportUnavailable(AuditModuleResult module) {
        return "http".equals(module.id()) && module.data()!=null && module.data().get("statusCode") instanceof Number status && status.intValue()<=0;
    }
    public static MeasurementCoverage compute(ScorePolicy policy, List<AuditModuleResult> modules) {
        var byModule = MeasurementAvailability.index(modules);
        Map<String, Observed> observed = new HashMap<>();
        for (var module : modules) for (var check : module.checks()) observed.putIfAbsent(check.key(), new Observed(module, check));
        boolean antiBot = antiBot(modules);
        var checks = new ArrayList<Check>();
        for (String key : new TreeSet<>(policy.cataloguedKeys())) {
            var rule = policy.ruleFor(null, key);
            if (!rule.applicability().contributesToScore() || rule.weight() <= 0 || rule.businessCategory() == BusinessCategory.NONE) continue;
            String owner = rule.technicalSource().tag();
            var occurrence = observed.get(key);
            MeasurementAvailability.Decision decision;
            if (occurrence != null) {
                decision = MeasurementAvailability.resolve(occurrence.module(), occurrence.check(), byModule, antiBot);
            } else if (byModule.get(owner) == null) {
                decision = new MeasurementAvailability.Decision(blocked(owner, key, antiBot) ? State.BLOCKED_BY_ANTIBOT : State.UNAVAILABLE,
                    blocked(owner, key, antiBot) ? "HTTP_CHALLENGE_OBSERVED" : "MODULE_MISSING", null, List.of());
            } else {
                var missing = AuditCheckResult.of(key, key, AuditStatus.INFO,
                    com.dokor.argos.services.analysis.model.enums.AuditSeverity.LOW,
                    false, 0, List.of(), null, Map.of(), null, null);
                decision = MeasurementAvailability.resolve(byModule.get(owner), missing, byModule, antiBot);
                if ("MEASUREMENT_MISSING".equals(decision.reason())) {
                    boolean conditional = Set.of("http.errors", "http.antibot.challenge").contains(key)
                        && observed.containsKey("http.final_url.https");
                    decision = new MeasurementAvailability.Decision(conditional ? State.NOT_APPLICABLE : State.UNAVAILABLE,
                        conditional ? "CONDITIONAL_SIGNAL_ABSENT" : "CHECK_MISSING", null, List.of());
                } else {
                    // No observation exists: the owner explains availability, but is not a measurement source.
                    decision = new MeasurementAvailability.Decision(decision.state(), decision.reason(), null, List.of());
                }
            }
            checks.add(new Check(key, rule.businessCategory().tag(), owner, rule.weight(), decision.state(),
                decision.reason(), "SSL_ENDPOINTS_PARTIALLY_MEASURED".equals(decision.reason()) ? "PARTIAL" : decision.measured() ? "MEASURED" : "UNKNOWN", decision.module(), decision.sources()));
        }
        var domains=Arrays.stream(ScoreDomain.values()).map(d -> aggregate(d.id(),checks.stream().filter(c -> c.domain().equals(d.id())).toList())).toList();
        var global=aggregate("global",checks);
        boolean provisional=!global.sufficient() || domains.stream().anyMatch(d -> d.expectedWeight()>0 && !d.sufficient());
        return new MeasurementCoverage(VERSION,THRESHOLD,global,domains,List.copyOf(checks),provisional);
    }
    private record Observed(AuditModuleResult module, AuditCheckResult check) {}

    private static Aggregate aggregate(String key,List<Check> checks) {
        double measured=checks.stream().filter(c -> c.state()==State.MEASURED).mapToDouble(Check::weight).sum();
        double expected=checks.stream().filter(c -> c.state()!=State.NOT_APPLICABLE).mapToDouble(Check::weight).sum();
        double ratio=expected>0?measured/expected:0;
        return new Aggregate(key,measured,expected,ratio,measured>0,expected>0 && ratio>=THRESHOLD && checks.stream().noneMatch(c -> "PARTIAL".equals(c.confidence())));
    }
}
