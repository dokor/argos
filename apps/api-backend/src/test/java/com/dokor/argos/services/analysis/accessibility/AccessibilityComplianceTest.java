package com.dokor.argos.services.analysis.accessibility;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.domain.report.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityCompliance.*;
import static com.dokor.argos.services.analysis.accessibility.AccessibilityRegulatoryScopeService.*;

class AccessibilityComplianceTest {
    private final AccessibilityRegulatoryScopeService scopes = new AccessibilityRegulatoryScopeService();
    private final AccessibilityComplianceRiskService risk = new AccessibilityComplianceRiskService();
    private static Fact verified(boolean value) { return new Fact(value, Provenance.VERIFIED); }
    private static Fact declared(boolean value) { return new Fact(value, Provenance.DECLARED); }
    private static AccessibilityEvidence evidence(int failures, AccessibilityEvidence.Coverage coverage) {
        return new AccessibilityEvidence("v1", "mapping-v1", "13.0.0", coverage, 20,
            Map.of(), failures, 0, false, 0, false, List.of());
    }
    @Test void storefrontAndCommercialHypothesesKeepUnknownInformation() {
        var small = scopes.qualify("<h1>Conseil aux PME</h1>", false, Facts.unknown());
        assertEquals(List.of(Scope.UNKNOWN), small.scopes());
        var store = scopes.qualify("<p>12 &euro;</p><button>Ajouter au panier</button>", false, Facts.unknown());
        assertEquals(List.of(Scope.POTENTIALLY_EAA), store.scopes());
        assertEquals(Confidence.LOW, store.confidence());
        assertTrue(store.missingInformation().containsAll(List.of("ENTERPRISE_SIZE", "EXEMPTIONS", "B2C_SERVICE")));
        assertEquals(Risk.UNKNOWN, risk.assess(evidence(12, AccessibilityEvidence.Coverage.COMPLETE), store,
            new AccessibilityComplianceRiskService.Rules("fixture-approved-v1", true)).risk());
    }
    @Test void scriptsCommentsTemplatesAndBlockedPagesCannotSupplyCommerceEvidence() {
        for (String html : List.of("<!-- 12€ panier -->", "<script\n type='text/javascript'>12€ panier</script>",
            "<style>12€ cart</style>", "<template>12€ cart</template>", "<script>12€ cart",
            "<template><template></template>12€ cart</template>")) {
            assertEquals(List.of(Scope.UNKNOWN), scopes.qualify(html, false, Facts.unknown()).scopes());
        }
        assertEquals(List.of(Scope.UNKNOWN), scopes.qualify("12€ panier", true, Facts.unknown()).scopes());
    }
    @Test void publicAndLargeEnterpriseFactsAllowCumulativeCandidatesWithoutInferringExemptions() {
        var publicBody = scopes.qualify(null, false, new Facts(null, verified(true), null, null, verified(true)));
        assertEquals(List.of(Scope.POTENTIALLY_ARTICLE_47), publicBody.scopes());
        var largeCompany = scopes.qualify(null, false, new Facts(verified(true), verified(true), null, null, verified(true)));
        assertEquals(List.of(Scope.POTENTIALLY_EAA, Scope.POTENTIALLY_ARTICLE_47), largeCompany.scopes());
        assertEquals(Confidence.HIGH, largeCompany.confidence());
        var exemption = scopes.qualify("12€ panier", false,
            new Facts(null, null, null, declared(true), null));
        assertFalse(exemption.scopes().contains(Scope.OUT_OF_SCOPE));
        assertTrue(exemption.signals().stream().anyMatch(s -> s.code().equals("EXEMPTION")
            && s.provenance() == Provenance.DECLARED));
    }
    @Test void onlyReviewedFactsGetHighConfidenceAndExplicitDeterminationCanBeOutsideScope() {
        assertEquals(Confidence.LOW, scopes.qualify(null, false,
            new Facts(verified(true), null, null, null, null)).confidence());
        assertEquals(List.of(Scope.UNKNOWN), scopes.qualify(null, false,
            new Facts(null, null, declared(true), null, null)).scopes());
        assertEquals(List.of(Scope.OUT_OF_SCOPE), scopes.qualify(null, false,
            new Facts(null, null, verified(true), null, null)).scopes());
        var conflict = scopes.qualify("20€ cart", false, new Facts(null, null, verified(true), null, null));
        assertEquals(Confidence.LOW, conflict.confidence());
        assertTrue(conflict.missingInformation().contains("CONFLICTING_SCOPE"));
    }
    @Test void riskProposalUsesFullFailureCountOnlyAfterAllGates() {
        var scope = scopes.qualify(null, false, new Facts(verified(true), null, null, null, verified(true)));
        var approved = new AccessibilityComplianceRiskService.Rules("fixture-approved-v1", true);
        int[] counts = {0, 1, 2, 3, 9, 10, 70};
        Risk[] levels = {Risk.LOW, Risk.MEDIUM, Risk.MEDIUM, Risk.HIGH, Risk.HIGH, Risk.CRITICAL, Risk.CRITICAL};
        for (int i=0; i<counts.length; i++)
            assertEquals(levels[i], risk.assess(evidence(counts[i], AccessibilityEvidence.Coverage.COMPLETE), scope, approved).risk());
        for (var coverage : List.of(AccessibilityEvidence.Coverage.PARTIAL, AccessibilityEvidence.Coverage.UNAVAILABLE))
            assertEquals(Risk.UNKNOWN, risk.assess(evidence(10, coverage), scope, approved).risk());
        var pending = risk.assess(evidence(10, AccessibilityEvidence.Coverage.COMPLETE), scope,
            AccessibilityComplianceRiskService.Rules.pending());
        assertEquals(Risk.UNKNOWN, pending.risk());
        assertEquals(RiskReason.RULES_PENDING, pending.riskReason());
        assertFalse(pending.rulesValidated());
    }
    @Test void persistenceDoesNotRequalifyHistoricalReportsAndAiEnrichmentPreservesSnapshot() throws Exception {
        var scope = scopes.qualify("20€ panier", false, Facts.unknown());
        var qualification = risk.assess(evidence(3, AccessibilityEvidence.Coverage.COMPLETE), scope,
            new AccessibilityComplianceRiskService.Rules("historical-fixture-v1", false));
        var internal = new AuditReportJson(6, "https://example.com", "https://example.com", Instant.now(),
            Map.of(), List.of(new AuditModuleResult("lighthouse", "", "",
            Map.of("accessibilityCompliance", qualification), List.of())), null);
        var mapper = new ObjectMapper().findAndRegisterModules();
        var roundTrip = mapper.readValue(mapper.writeValueAsString(internal), AuditReportJson.class);
        var dto = new PublicReportComposer().compose(roundTrip);
        assertEquals(qualification, dto.accessibilityCompliance());
        assertEquals(dto, mapper.readValue(mapper.writeValueAsString(dto), ReportDto.class));
        assertNull(new PublicReportComposer().compose(new AuditReportJson(6, "", "", Instant.now(),
            Map.of(), List.of(), null)).accessibilityCompliance());
        var client = org.mockito.Mockito.mock(CodexSummaryClient.class);
        var ai = new ReportDto.AiSummary(null, null);
        org.mockito.Mockito.when(client.summarize(dto)).thenReturn(Optional.of(ai));
        assertEquals(qualification, new AiReportSummaryService(client).enrich(dto).accessibilityCompliance());
    }
}
