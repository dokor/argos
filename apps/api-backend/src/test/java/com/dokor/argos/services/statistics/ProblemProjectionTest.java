package com.dokor.argos.services.statistics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static com.dokor.argos.services.statistics.ProblemStatisticsFixture.*;

class ProblemProjectionTest {
    @Test void deduplicatesCanonicalFindingsAndNeverCopiesPrivateMaterial() throws Exception {
        var report=report(true,false);
        var issues=(ArrayNode)report.path("issues");
        issues.add(issues.get(0).<ObjectNode>deepCopy().put("severity","critical"));
        var projection=ProblemProjection.from(report,POLICY);
        assertEquals(1,projection.checks().stream().filter(c->c.severity()!=null).count());
        assertEquals("important",projection.checks().stream().filter(c->c.key().equals(KEY)).findFirst().orElseThrow().severity());
        String json=new ObjectMapper().writeValueAsString(projection);
        assertFalse(json.contains("private")); assertFalse(json.contains("evidence")); assertFalse(json.contains("https:"));
    }
    @Test void partialReportsOnlyContributeMeasuredControls() {
        var projection=ProblemProjection.from(report(true,true),POLICY);
        assertEquals(true,projection.partial()); assertEquals(1,projection.checks().size()); assertEquals(KEY,projection.checks().getFirst().key());
        for(String state:new String[]{"UNAVAILABLE","BLOCKED_BY_ANTIBOT","NOT_APPLICABLE"}) {
            var report=report(true,true);
            for(var check:report.path("scores").path("coverage").path("checks")) if(KEY.equals(check.path("key").asText())) ((ObjectNode)check).put("state",state);
            assertNull(ProblemProjection.from(report,POLICY).partial());
        }
    }
    @Test void measuredSuccessHasNoFindingAndUnknownMeasurementIsNotSuccess() {
        assertTrue(ProblemProjection.from(report(false,false),POLICY).checks().stream().allMatch(c->c.severity()==null));
        var report=report(false,false);
        ((ArrayNode)report.path("scores").path("coverage").path("checks")).remove(0);
        assertNull(ProblemProjection.from(report,POLICY).partial());
    }
    @Test void excludesChangedMethodsMissingCoverageAndAmbiguousDefinitions() {
        var changed=report(true,false);
        ((ObjectNode)changed.path("scores").path("calculation")).put("scoringFingerprint","older");
        assertNull(ProblemProjection.from(changed,POLICY).partial());
        var missing=report(true,false); ((ObjectNode)missing.path("scores")).remove("coverage");
        assertNull(ProblemProjection.from(missing,POLICY).partial());
        var ambiguous=report(true,false); var checks=(ArrayNode)ambiguous.path("scores").path("coverage").path("checks");
        checks.add(checks.get(0).<ObjectNode>deepCopy().put("state","UNAVAILABLE"));
        assertNull(ProblemProjection.from(ambiguous,POLICY).partial());
        var duplicate=report(true,false); var identical=(ArrayNode)duplicate.path("scores").path("coverage").path("checks"); identical.add(identical.get(0).deepCopy());
        assertEquals(identical.size()-1,ProblemProjection.from(duplicate,POLICY).checks().size());
    }
}
