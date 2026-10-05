package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.scoring.MeasurementCoverage;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class AuditComparisonServiceTest {
    private ReportDto fixture(int version,String fingerprint,double quality,MeasurementCoverage.State state,boolean provisional) {
        var check=new MeasurementCoverage.Check("ssl.grade","security","ssl",10,state,"FIXTURE_OBSERVATION","MEASURED");
        var aggregate=new MeasurementCoverage.Aggregate("global",state==MeasurementCoverage.State.MEASURED?10:0,10,state==MeasurementCoverage.State.MEASURED?1:0,state==MeasurementCoverage.State.MEASURED,!provisional);
        var coverage=new MeasurementCoverage("weighted-coverage-v1",.8,aggregate,List.of(aggregate),List.of(check),provisional);
        var calculation=new ReportDto.ScoreCalculation(version,fingerprint,List.of(new ReportDto.DomainCalculation("security",quality*10,10,quality,1)),Map.of("security",.25,"a11y",.25,"seo",.25,"performance",.25),List.of(new ReportDto.CheckCalculation("ssl.grade","ssl","security",10,quality*10)));
        return new ReportDto("2026-10-05","example.com","https://example.com",null,new ReportDto.Scores((int)Math.round(quality*100),100,List.of(),true,calculation,coverage),null,List.of(),null,null);
    }
    @Test void sameFrozenMethodReportsDeltasAndCheckContributors() {
        var previous=fixture(11,"frozen",.5,MeasurementCoverage.State.MEASURED,false);
        var current=fixture(11,"frozen",.9,MeasurementCoverage.State.MEASURED,false);
        var result=AuditComparisonService.compare(previous,current);
        assertEquals(AuditComparisonService.Reason.COMPARABLE,result.reason());assertEquals(40,result.globalDelta());
        assertEquals(40,result.domains().getFirst().points(),1e-9);assertEquals("ssl.grade",result.contributions().getFirst().key());assertEquals(40,result.contributions().getFirst().globalPoints(),1e-9);
        assertEquals(50,previous.scores().global()); // historical quality remains unchanged
    }
    @Test void versionAndFingerprintChangesNeverGenerateDelta() {
        var previous=fixture(11,"frozen",.5,MeasurementCoverage.State.MEASURED,false);
        for(var current:List.of(fixture(12,"frozen",.9,MeasurementCoverage.State.MEASURED,false),fixture(11,"changed",.9,MeasurementCoverage.State.MEASURED,false))) {
            var result=AuditComparisonService.compare(previous,current);assertEquals(AuditComparisonService.Reason.METHODOLOGY_CHANGED,result.reason());assertNull(result.globalDelta());assertTrue(result.contributions().isEmpty());
        }
    }
    @Test void moduleUnavailableAntibotAndMissingDomainAreCoverageChanges() {
        var previous=fixture(11,"frozen",.5,MeasurementCoverage.State.MEASURED,false);
        for(var state:List.of(MeasurementCoverage.State.UNAVAILABLE,MeasurementCoverage.State.BLOCKED_BY_ANTIBOT,MeasurementCoverage.State.NOT_APPLICABLE)) {
            var current=fixture(11,"frozen",.9,state,true);var result=AuditComparisonService.compare(previous,current);
            assertEquals(AuditComparisonService.Reason.COVERAGE_CHANGED,result.reason());assertTrue(result.coverageChanged());assertNull(result.globalDelta());
        }
    }
    @Test void identicalButInsufficientCoverageIsStillNotComparable() {
        var previous=fixture(11,"frozen",.5,MeasurementCoverage.State.UNAVAILABLE,true);
        var current=fixture(11,"frozen",.9,MeasurementCoverage.State.UNAVAILABLE,true);
        assertEquals(AuditComparisonService.Reason.INSUFFICIENT_COVERAGE,AuditComparisonService.compare(previous,current).reason());
    }
    @Test void historicalReportsWithoutFrozenEvidenceAreNeverRecalculated() throws Exception {
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
        var historical=mapper.readValue("{\"url\":\"https://example.com\",\"scores\":{\"global\":73,\"byCategory\":[]}}",ReportDto.class);
        var current=fixture(11,"frozen",.9,MeasurementCoverage.State.MEASURED,false);
        assertEquals(AuditComparisonService.Reason.EVIDENCE_MISSING,AuditComparisonService.compare(historical,current).reason());
        assertEquals(73,historical.scores().global());assertNull(historical.scores().calculation());
    }
    @Test void configuredWeightsScopeAndActualDenominatorMustMatch() throws Exception {
        var mapper=new com.fasterxml.jackson.databind.ObjectMapper();var previous=fixture(11,"frozen",.5,MeasurementCoverage.State.MEASURED,false);
        var raw=mapper.valueToTree(previous);
        ((com.fasterxml.jackson.databind.node.ObjectNode)raw.path("scores").path("calculation").path("configuredDomainWeights")).put("security",.5);
        assertEquals(AuditComparisonService.Reason.METHODOLOGY_CHANGED,AuditComparisonService.compare(previous,mapper.treeToValue(raw,ReportDto.class)).reason());
        raw=mapper.valueToTree(previous);((com.fasterxml.jackson.databind.node.ObjectNode)raw).put("url","https://example.com/other");
        assertEquals(AuditComparisonService.Reason.SCOPE_CHANGED,AuditComparisonService.compare(previous,mapper.treeToValue(raw,ReportDto.class)).reason());
        raw=mapper.valueToTree(previous);((com.fasterxml.jackson.databind.node.ObjectNode)raw.path("scores").path("calculation").path("domains").get(0)).put("maxScore",20);
        assertEquals(AuditComparisonService.Reason.COVERAGE_CHANGED,AuditComparisonService.compare(previous,mapper.treeToValue(raw,ReportDto.class)).reason());
    }
}
