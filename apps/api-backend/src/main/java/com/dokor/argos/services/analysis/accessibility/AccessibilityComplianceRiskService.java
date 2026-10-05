package com.dokor.argos.services.analysis.accessibility;

import jakarta.inject.Singleton;
import java.util.*;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityCompliance.*;

@Singleton
public class AccessibilityComplianceRiskService {
    public static final String VERSION = "accessibility-compliance-proposal-v1";
    private static final List<Reference> REFERENCES = List.of(
        new Reference("Directive 2019/882", "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019L0882"),
        new Reference("Décret article 47", "https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000038956842"));
    public record Rules(String version, boolean validated) {
        public static Rules pending() { return new Rules(VERSION, false); }
    }
    public AccessibilityCompliance assess(AccessibilityEvidence evidence,
        AccessibilityRegulatoryScopeService.Qualification scope, Rules rules) {
        Risk risk = Risk.UNKNOWN;
        RiskReason reason;
        if (!rules.validated()) reason = RiskReason.RULES_PENDING;
        else if (scope.scopes().contains(Scope.OUT_OF_SCOPE)) reason = RiskReason.OUTSIDE_SCOPE;
        else if (scope.confidence() != Confidence.HIGH || scope.scopes().contains(Scope.UNKNOWN))
            reason = RiskReason.SCOPE_UNKNOWN;
        else if (evidence == null || evidence.coverage() != AccessibilityEvidence.Coverage.COMPLETE)
            reason = RiskReason.COLLECTION_INCOMPLETE;
        else {
            int failures = evidence.failedAudits();
            risk = failures == 0 ? Risk.LOW : failures < 3 ? Risk.MEDIUM : failures < 10 ? Risk.HIGH : Risk.CRITICAL;
            reason = failures == 0 ? RiskReason.NO_DETECTED_FAILURE : RiskReason.FAILED_AUDITS;
        }
        List<String> missing = new ArrayList<>(scope.missingInformation());
        if (!rules.validated()) missing.add("RULES_REVIEW");
        return new AccessibilityCompliance(rules.version(), rules.validated(), scope.scopes(), scope.confidence(),
            risk, reason, scope.signals(), List.copyOf(missing), REFERENCES);
    }
}
