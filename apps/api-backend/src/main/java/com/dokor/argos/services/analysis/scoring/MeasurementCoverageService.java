package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import java.util.*;
import static com.dokor.argos.services.analysis.scoring.MeasurementCoverage.*;

public final class MeasurementCoverageService {
    public static final String VERSION = "weighted-coverage-v1";
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
    public static MeasurementCoverage compute(ScorePolicy policy, List<AuditModuleResult> modules) {
        Map<String, AuditModuleResult> byModule = new HashMap<>();
        Map<String, AuditCheckResult> observed = new HashMap<>();
        for (var module:modules) { byModule.put(module.id(),module); for(var check:module.checks()) observed.putIfAbsent(check.key(),check); }
        boolean antiBot = antiBot(modules);
        var checks = new ArrayList<Check>();
        for(String key:new TreeSet<>(policy.cataloguedKeys())) {
            var rule = policy.ruleFor(null,key);
            if (!rule.applicability().contributesToScore() || rule.weight()<=0 || rule.businessCategory()==BusinessCategory.NONE) continue;
            String moduleId=rule.technicalSource().tag(); var module=byModule.get(moduleId); var check=observed.get(key);
            State state; String reason;
            Object explicit = check != null && check.details()!=null ? check.details().get("measurementState") : null;
            Object explicitReason = check != null && check.details()!=null ? check.details().get("measurementReason") : null;
            Object moduleState = module != null && module.data()!=null ? module.data().get("measurementState") : null;
            Object moduleReason = module != null && module.data()!=null ? module.data().get("measurementReason") : null;
            if ("NOT_APPLICABLE".equals(explicit) && explicitReason instanceof String r && !r.isBlank()) { state=State.NOT_APPLICABLE; reason=r; }
            else if ("NOT_APPLICABLE".equals(moduleState) && moduleReason instanceof String r && !r.isBlank()) {state=State.NOT_APPLICABLE;reason=r;}
            else if ("http.redirect.to_https".equals(key) && check != null && check.value() instanceof Map<?,?> value && Boolean.FALSE.equals(value.get("inputIsHttp"))) {state=State.NOT_APPLICABLE;reason="INPUT_ALREADY_HTTPS";}
            else if(blocked(moduleId,key,antiBot)) {state=State.BLOCKED_BY_ANTIBOT;reason="HTTP_CHALLENGE_OBSERVED";}
            else if(check!=null && (check.status()!=AuditStatus.INFO || check.value()!=null)) {state=State.MEASURED;reason="CHECK_OBSERVED";}
            else if(Set.of("http.errors","http.antibot.challenge").contains(key) && module != null && observed.containsKey("http.final_url.https")) {state=State.NOT_APPLICABLE;reason="CONDITIONAL_SIGNAL_ABSENT";}
            else {state=State.UNAVAILABLE;reason=module==null?"MODULE_MISSING":check==null?"CHECK_MISSING":"MEASUREMENT_MISSING";}
            checks.add(new Check(key,rule.businessCategory().tag(),moduleId,rule.weight(),state,reason,state==State.MEASURED?"MEASURED":"UNKNOWN"));
        }
        var domains=Arrays.stream(ScoreDomain.values()).map(d -> aggregate(d.id(),checks.stream().filter(c -> c.domain().equals(d.id())).toList())).toList();
        var global=aggregate("global",checks);
        boolean provisional=!global.sufficient() || domains.stream().anyMatch(d -> d.expectedWeight()>0 && !d.sufficient());
        return new MeasurementCoverage(VERSION,THRESHOLD,global,domains,List.copyOf(checks),provisional);
    }
    private static Aggregate aggregate(String key,List<Check> checks) {
        double measured=checks.stream().filter(c -> c.state()==State.MEASURED).mapToDouble(Check::weight).sum();
        double expected=checks.stream().filter(c -> c.state()!=State.NOT_APPLICABLE).mapToDouble(Check::weight).sum();
        double ratio=expected>0?measured/expected:0;
        return new Aggregate(key,measured,expected,ratio,measured>0,expected>0 && ratio>=THRESHOLD);
    }
}
