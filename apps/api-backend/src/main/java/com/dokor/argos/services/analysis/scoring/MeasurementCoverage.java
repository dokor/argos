package com.dokor.argos.services.analysis.scoring;

import java.util.List;

/** Frozen measurement evidence, independent of site quality and operational module completion. */
public record MeasurementCoverage(String version, double threshold, Aggregate global,
                                  List<Aggregate> domains, List<Check> checks, boolean provisional) {
    public enum State { MEASURED, UNAVAILABLE, BLOCKED_BY_ANTIBOT, NOT_APPLICABLE }
    public record Aggregate(String key, double measuredWeight, double expectedWeight,
                            double ratio, boolean available, boolean sufficient) {}
    public record Check(String key, String domain, String module, double weight, State state,
                        String reason, String confidence) {}
}
