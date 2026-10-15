package com.dokor.argos.services.domain.report;
import com.dokor.argos.services.analysis.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ObservedMeasurementsTest {
    private static AuditModuleResult module(String name,Map<String,Object> data){return new AuditModuleResult(name,name,"",data,List.of());}
    private static AuditReportJson report(AuditModuleResult... modules){return new AuditReportJson(1,"https://example.com/path","https://example.com/path",Instant.EPOCH,Map.of(),List.of(modules),null);}
    @Test void publishesSuccessfulMeasurementsWithoutAnyFinding() {
        var dto=new PublicReportComposer().compose(report(
            module("lighthouse",Map.of("observedMetrics",Map.of("lcpMs",1200,"fcpMs",500))),
            module("runtime",Map.of("network",Map.of("requests",20,"status5xx",0,"totalBytesEstimated",50000),"jsErrors",Map.of("count",0),"timings",Map.of("loadMs",800))),
            module("html",Map.of("htmlBytes",1000,"scriptCount",0)),module("http",Map.of("responseSnapshotAvailable",true,"durationMs",30))));
        assertTrue(dto.issues().isEmpty());assertEquals(1200,dto.measurements().lcpMs());assertEquals(0,dto.measurements().http5xx());
        assertEquals(0,dto.measurements().scripts());assertEquals(30,dto.measurements().responseMs());assertNull(dto.measurements().http4xx());
    }
    @Test void unavailableInvalidAndMissingAreNotZero() {
        var values=ObservedMeasurements.from(report(module("lighthouse",Map.of("available",false,"observedMetrics",Map.of("lcpMs",0))),
            module("runtime",Map.of("network",Map.of("requests",-1,"totalBytesEstimated",Double.NaN,"status5xx",0))),
            module("http",Map.of("durationMs",123))));
        assertNull(values.lcpMs());assertNull(values.requests());assertNull(values.transferredBytes());assertNull(values.responseMs());assertEquals(0,values.http5xx());
    }
    @Test void historicalReportsAndCopyOperationsKeepMeasurements() throws Exception {
        var mapper=new ObjectMapper();var historical=mapper.readValue("{\"domain\":\"example.com\"}",ReportDto.class);assertNull(historical.measurements());
        var dto=new PublicReportComposer().compose(report(module("html",Map.of("scriptCount",0))));
        var copy=dto.withIntroduction(null).withPageIdentity(ReportPageIdentity.from("https://example.com/path",null));
        assertEquals(dto.measurements(),mapper.readValue(mapper.writeValueAsString(copy),ReportDto.class).measurements());
    }
    @Test void publicProjectionDoesNotExposeEvidenceOrCorrections() {
        var issue=new ReportDto.Issue("test","performance",List.of("performance"),"runtime",ReportDto.IssueSeverity.critical,
            "Slow","Impact","PRIVATE_EVIDENCE","PRIVATE_CORRECTION",null);
        var dto=new ReportDto("now","example.com","https://example.com",null,null,new ReportDto.Summary("fair",List.of(),null),List.of(issue),null,null);
        var summary=dto.publicSummary();assertEquals("summary",summary.access());assertNull(summary.issues().getFirst().evidence());
        assertNull(summary.issues().getFirst().recommendation());assertNull(summary.issues().getFirst().structuredEvidence());assertNull(summary.accessibilityEvidence());
        assertEquals("PRIVATE_EVIDENCE",dto.issues().getFirst().evidence());
    }
}
