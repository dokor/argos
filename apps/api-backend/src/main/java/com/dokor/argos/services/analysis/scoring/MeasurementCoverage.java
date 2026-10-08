package com.dokor.argos.services.analysis.scoring;

import java.util.List;

/** Frozen measurement evidence, independent of site quality and operational module completion. */
public record MeasurementCoverage(String version, double threshold, Aggregate global,
                                  List<Aggregate> domains, List<Check> checks, boolean provisional) {
    public enum State { MEASURED, UNAVAILABLE, BLOCKED_BY_ANTIBOT, NOT_APPLICABLE }
    public record Aggregate(String key, double measuredWeight, double expectedWeight,
                            double ratio, boolean available, boolean sufficient) {}
    /** module is the catalogue owner; measurementModule/sources describe the actual observation. */
    public record Check(String key, String domain, String module, double weight, State state,
                        String reason, String confidence, String measurementModule, List<String> measurementSources) {
        public Check {
            if (measurementSources != null) measurementSources = measurementSources.stream().distinct().sorted().toList();
        }
        public Check(String key, String domain, String module, double weight, State state, String reason, String confidence) {
            this(key, domain, module, weight, state, reason, confidence, null, null);
        }
    }
}
