package com.dokor.argos.services.analysis.accessibility;

import java.util.List;
import java.util.Map;

/** Independent, bounded, non-scoring snapshot. No page text or DOM is stored. */
public record AccessibilityEvidence(
    String version, String mappingVersion, String sourceVersion, Coverage coverage,
    int referencedAudits, Map<Status, Integer> statusCounts, int failedAudits,
    int reportedElements, boolean elementCountComplete, int surfacedFindings,
    boolean truncated, List<Finding> findings
) {
    public enum Coverage { COMPLETE, PARTIAL, UNAVAILABLE }
    public enum Status { PASS, FAIL, MANUAL, NOT_APPLICABLE, NOT_TESTED, ERROR }
    public enum Kind { IMAGE_ALTERNATIVE, CONTRAST, ACCESSIBLE_NAME, LANGUAGE, OTHER }
    public enum Severity { LOW, MEDIUM, HIGH }
    public record Finding(String id, String source, Kind kind, Severity severity,
                          Double score, Integer reportedElements, List<String> wcagCriteria) {}
}
