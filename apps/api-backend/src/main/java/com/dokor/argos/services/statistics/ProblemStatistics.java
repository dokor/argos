package com.dokor.argos.services.statistics;

import java.time.Instant;
import java.util.List;

/** Only public rule identifiers and aggregates cross the administration API boundary. */
public record ProblemStatistics(Instant from, Instant until, Instant generatedAt,
    int scoringVersion, String scoringFingerprint, String coverageVersion, int minimumGroupSize,
    long reports, long domains, long retainedDomains, long partialDomains, long excludedDomains,
    long pendingDomains, List<Finding> findings) {
    public record Finding(String key, String category, String severity,
                          long affectedDomains, long measuredDomains, double frequency) {}
}
