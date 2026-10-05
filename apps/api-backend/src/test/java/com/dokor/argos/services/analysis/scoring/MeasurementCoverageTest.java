package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class MeasurementCoverageTest {
    private final ScorePolicy policy=new DefaultScorePolicy();
    private List<AuditModuleResult> complete() {
        Map<String,List<AuditCheckResult>> modules=new LinkedHashMap<>();
        for(String key:policy.cataloguedKeys()) {
            var rule=policy.ruleFor(null,key); if(!rule.applicability().contributesToScore()) continue;
            modules.computeIfAbsent(rule.technicalSource().tag(),ignored -> new ArrayList<>()).add(check(key));
        }
        return modules.entrySet().stream().map(e -> new AuditModuleResult(e.getKey(),e.getKey(),null,Map.of(),e.getValue())).toList();
    }
    private AuditCheckResult check(String key) {return AuditCheckResult.of(key,key,AuditStatus.PASS,AuditSeverity.LOW,true,0,List.of(),true,Map.of(),null,null);}
    private MeasurementCoverage coverage(List<AuditModuleResult> modules) {return MeasurementCoverageService.compute(policy,modules);}
    @Test void completeCatalogueIsMeasuredWithoutChangingQuality() {
        var raw=complete();var result=coverage(raw);assertEquals(1,result.global().ratio());assertFalse(result.provisional());
        double expected=policy.cataloguedKeys().stream().map(k -> policy.ruleFor(null,k)).filter(r -> r.applicability().contributesToScore()).mapToDouble(ScorePolicy.ScoreRule::weight).sum();
        assertEquals(expected,result.global().expectedWeight());
        var enriched=new ScoreEnricherService(policy).enrich(raw);var score=new ScoreService(policy).compute(policy.version(),policy.fingerprint(),enriched);
        assertEquals(1,score.global().ratio());assertNotNull(score.coverage());
    }
    @Test void unavailableInfrastructurePreservesMeasuredQualityAndChangesCoverage() {
        var partial=complete().stream().filter(m -> !"lighthouse".equals(m.id())).toList();
        var result=coverage(partial);assertTrue(result.provisional());assertTrue(result.checks().stream().filter(c -> c.module().equals("lighthouse")).allMatch(c -> c.state()==MeasurementCoverage.State.UNAVAILABLE));
        var score=new ScoreService(policy).compute(policy.version(),policy.fingerprint(),new ScoreEnricherService(policy).enrich(partial));assertEquals(1,score.global().ratio());
    }
    @Test void antibotNeverScoresTheChallengePageAsTheSite() {
        var raw=complete().stream().map(m -> new AuditModuleResult(m.id(),m.title(),m.summary(),"http".equals(m.id())?Map.of("antiBotDetected",true):m.data(),m.checks())).toList();
        var result=coverage(raw);assertTrue(result.provisional());assertTrue(result.checks().stream().filter(c -> c.module().equals("html")).allMatch(c -> c.state()==MeasurementCoverage.State.BLOCKED_BY_ANTIBOT));
        var enriched=new ScoreEnricherService(policy).enrich(raw);assertTrue(enriched.stream().filter(m -> m.id().equals("html")).flatMap(m -> m.checks().stream()).noneMatch(AuditCheckResult::scorable));
    }
    @Test void explicitNonApplicableDomainIsExcludedButHasNoFabricatedQuality() {
        var module=new AuditModuleResult("lighthouse","LH",null,Map.of("measurementState","NOT_APPLICABLE","measurementReason","EXPLICIT_FIXTURE_SCOPE"),List.of());
        var result=coverage(List.of(module));
        assertTrue(result.checks().stream().filter(c -> c.module().equals("lighthouse")).allMatch(c -> c.state()==MeasurementCoverage.State.NOT_APPLICABLE));
        assertEquals(0,result.global().measuredWeight());assertFalse(result.global().available());
        var empty=new ScoreService(policy).compute(policy.version(),policy.fingerprint(),List.of());assertEquals(0,empty.global().maxScore());assertTrue(empty.coverage().provisional());
    }
    @Test void oneMissingSecurityMeasurementLeavesOtherDomainsComplete() {
        var partial=complete().stream().map(m -> new AuditModuleResult(m.id(),m.title(),m.summary(),m.data(),m.checks().stream().filter(c -> !c.key().equals("ssl.grade")).toList())).toList();
        var result=coverage(partial);
        for(var domain:result.domains()) if(!domain.key().equals("security")) assertEquals(1,domain.ratio());
        assertTrue(result.domains().stream().filter(d -> d.key().equals("security")).allMatch(d -> d.ratio()<1));
    }
    @Test void missingReasonCannotSilentlyExcludeExpectedWeight() {
        var module=new AuditModuleResult("lighthouse","LH",null,Map.of("measurementState","NOT_APPLICABLE"),List.of());
        assertTrue(coverage(List.of(module)).checks().stream().filter(c -> c.module().equals("lighthouse")).allMatch(c -> c.state()==MeasurementCoverage.State.UNAVAILABLE));
    }
    @Test void entireExplicitlyExcludedDomainIsNotQualityZero() {
        var only=org.mockito.Mockito.mock(ScorePolicy.class);
        org.mockito.Mockito.when(only.cataloguedKeys()).thenReturn(Set.of("lighthouse.score.accessibility"));
        org.mockito.Mockito.when(only.ruleFor(null,"lighthouse.score.accessibility")).thenReturn(new ScorePolicy.ScoreRule(ScoreApplicability.SCORE,10,BusinessCategory.A11Y,TechnicalSource.LIGHTHOUSE));
        var module=new AuditModuleResult("lighthouse","LH",null,Map.of("measurementState","NOT_APPLICABLE","measurementReason","EXPLICIT_FIXTURE_SCOPE"),List.of(check("lighthouse.score.accessibility")));
        var result=MeasurementCoverageService.compute(only,List.of(module));
        var domain=result.domains().stream().filter(d -> d.key().equals("a11y")).findFirst().orElseThrow();
        assertEquals(0,domain.expectedWeight());assertFalse(domain.available());
        var enriched=new ScoreEnricherService(only).enrich(List.of(module));
        assertFalse(enriched.getFirst().checks().getFirst().scorable());
    }
}
