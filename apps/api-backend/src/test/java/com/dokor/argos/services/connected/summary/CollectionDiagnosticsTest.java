package com.dokor.argos.services.connected.summary;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class CollectionDiagnosticsTest {
    @Test void exposesOnlyUnavailableChecksAndSafeCodesWithoutRawErrors() throws Exception {
        var f=SummaryFixture.fixture();
        var e=SummaryFixture.evidence(f,f.path("domains").get(0).path("pages").get(0));
        var d=DiagnosticProjection.from(e.report(),e.score());
        var rules=new ArrayList<DiagnosticProjection.Rule>(d.rules());
        rules.add(new DiagnosticProjection.Rule("ssl.grade","a".repeat(64),"security",List.of("ssl"),"UNAVAILABLE","https://private/?token=secret","IMPORTANT",null,null,null,false));
        rules.add(new DiagnosticProjection.Rule("runtime.lcp","b".repeat(64),"performance",List.of("runtime"),"UNAVAILABLE","TIMEOUT",null,null,null,null,false));
        rules.add(new DiagnosticProjection.Rule("bad\nkey","c".repeat(64),"security",List.of("ssl"),"UNKNOWN","CHECK_MISSING",null,null,null,null,false));
        rules.add(new DiagnosticProjection.Rule("ssl.optional","d".repeat(64),"security",List.of("ssl"),"NOT_APPLICABLE","HTTP_ONLY",null,null,null,null,false));
        var raw=SummaryFixture.MAPPER.writeValueAsString(new DiagnosticProjection(d.version(),true,0L,0L,.5,"v1",rules));
        var gaps=CollectionDiagnostics.gaps(raw);
        assertTrue(gaps.stream().anyMatch(g->g.ruleKey().equals("runtime.lcp")&&g.reason().equals("TIMEOUT")));
        assertTrue(gaps.stream().anyMatch(g->g.ruleKey().equals("ssl.grade")&&g.reason().equals("UNAVAILABLE")));
        assertFalse(gaps.toString().contains("secret"));
        assertFalse(gaps.stream().anyMatch(g->g.ruleKey().contains("bad")||g.ruleKey().equals("ssl.optional")));
        for (int version : new int[] {1, 3}) {
            var incompatible=SummaryFixture.MAPPER.writeValueAsString(new DiagnosticProjection(version,true,0L,0L,.5,"v1",rules));
            assertTrue(CollectionDiagnostics.gaps(incompatible).isEmpty());
        }
    }
    @Test void parsesBoundedModuleStatusesAndRejectsMalformedProjections() {
        assertEquals(Map.of("ssl",com.dokor.argos.services.connected.contract.ConnectedContracts.ModuleStatus.FAILED),CollectionDiagnostics.modules("[{\"id\":\"ssl\",\"status\":\"FAILED\"},{\"id\":\"bad/id\",\"status\":\"FAILED\"}]"));
        assertTrue(CollectionDiagnostics.gaps("bad").isEmpty()); assertTrue(CollectionDiagnostics.gaps("null").isEmpty()); assertTrue(CollectionDiagnostics.gaps(null).isEmpty());
        assertTrue(CollectionDiagnostics.gaps("{\"version\":1,\"rules\":[{}]}").isEmpty());
        assertTrue(CollectionDiagnostics.modules("{}").isEmpty()); assertTrue(CollectionDiagnostics.modules("").isEmpty());
    }
    @Test void batchPageCarriesTheExactRunAndKnownCollectionGaps() throws Exception {
        var rows=new DomainSummaryProjectionTest().rows(SummaryFixture.fixture());
        for(var row:rows) {
            var page=DomainSummaryProjection.page(row,SummaryFixture.MAPPER).result();
            assertEquals(Long.toString(row.state().runId()),page.runId());
            assertEquals(page.reportAvailable()?CollectionDiagnostics.gaps(row.diagnostic()):List.of(),page.collectionGaps());
        }
    }
}
