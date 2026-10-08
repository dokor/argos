package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import java.util.*;
import static com.dokor.argos.services.analysis.scoring.MeasurementCoverage.State;

/** One availability decision used by merging, scoring enrichment and coverage. */
public final class MeasurementAvailability {
    private MeasurementAvailability() {}
    public record Decision(State state, String reason, String module, List<String> sources) {
        public boolean measured() { return state == State.MEASURED; }
    }

    public static Decision resolve(AuditModuleResult carrier, AuditCheckResult check,
                                   Map<String, AuditModuleResult> modules, boolean antiBot) {
        var provenance = check.measurementProvenance();
        String source = provenance == null ? carrier.id() : provenance.module();
        List<String> sources = provenance == null ? List.of(carrier.id()) : provenance.sources();
        AuditModuleResult module = modules.get(source);
        if (module == null) return new Decision(State.UNAVAILABLE, "MEASUREMENT_SOURCE_MISSING", source, sources);
        Decision explicit = explicit(check.details(), source, sources);
        if (explicit != null) return explicit;
        explicit = explicit(module.data(), source, sources);
        if (explicit != null) return explicit;
        if (MeasurementCoverageService.transportUnavailable(module))
            return new Decision(State.UNAVAILABLE, "HTTP_TRANSPORT_UNAVAILABLE", source, sources);
        if ("http.redirect.to_https".equals(check.key()) && check.value() instanceof Map<?, ?> value
            && Boolean.FALSE.equals(value.get("inputIsHttp")))
            return new Decision(State.NOT_APPLICABLE, "INPUT_ALREADY_HTTPS", source, sources);
        if (MeasurementCoverageService.blocked(source, check.key(), antiBot))
            return new Decision(State.BLOCKED_BY_ANTIBOT, "HTTP_CHALLENGE_OBSERVED", source, sources);
        if (check.status() != AuditStatus.INFO || check.value() != null)
            return new Decision(State.MEASURED, "CHECK_OBSERVED", source, sources);
        return new Decision(State.UNAVAILABLE, "MEASUREMENT_MISSING", source, sources);
    }

    private static Decision explicit(Map<String, Object> data, String source, List<String> sources) {
        if (data == null || data.get("measurementState") == null || "MEASURED".equals(data.get("measurementState"))) return null;
        String reason = data.get("measurementReason") instanceof String r && !r.isBlank() ? r : null;
        State state;
        try { state = State.valueOf(data.get("measurementState").toString()); }
        catch (IllegalArgumentException unknown) {
            return new Decision(State.UNAVAILABLE, "UNKNOWN_MEASUREMENT_STATE", source, sources);
        }
        if (state == State.NOT_APPLICABLE && reason == null)
            return new Decision(State.UNAVAILABLE, "EXCLUSION_REASON_MISSING", source, sources);
        return new Decision(state, reason == null ? "MEASUREMENT_UNAVAILABLE" : reason, source, sources);
    }

    public static Map<String, AuditModuleResult> index(List<AuditModuleResult> modules) {
        Map<String, AuditModuleResult> index = new HashMap<>();
        modules.forEach(module -> index.put(module.id(), module));
        return index;
    }
}
