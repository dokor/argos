package com.dokor.argos.services.analysis.accessibility;

import java.util.List;

/** Versioned indicative qualification, independent of scores and legal conformance. */
public record AccessibilityCompliance(
    String accessibilityComplianceVersion, boolean rulesValidated,
    List<Scope> scopes, Confidence confidence, Risk risk, RiskReason riskReason,
    List<Signal> signals, List<String> missingInformation, List<Reference> references
) {
    public enum Scope { POTENTIALLY_EAA, POTENTIALLY_ARTICLE_47, OUT_OF_SCOPE, UNKNOWN }
    public enum Confidence { LOW, HIGH, UNKNOWN }
    public enum Risk { LOW, MEDIUM, HIGH, CRITICAL, UNKNOWN }
    public enum RiskReason { RULES_PENDING, SCOPE_UNKNOWN, COLLECTION_INCOMPLETE, FAILED_AUDITS, NO_DETECTED_FAILURE, OUTSIDE_SCOPE }
    public enum Provenance { OBSERVED, DECLARED, VERIFIED }
    public record Signal(String code, Provenance provenance, boolean value) {}
    public record Reference(String title, String url) {}
}
