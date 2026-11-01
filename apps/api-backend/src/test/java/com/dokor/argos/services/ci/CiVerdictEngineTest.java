package com.dokor.argos.services.ci;
import com.dokor.argos.services.ci.errors.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.file.*;
import java.util.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CiVerdictEngineTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private static final String ID="a2942a5c-b63a-45cd-a88a-d02b1af5db02";
    private CiVerdictEngine.Snapshot snapshot(JsonNode report){return CiVerdictEngine.from(report,"analysis-measurements-v6");}
    @Test void confirmsTheEntireInventoryAndKeepsPipelineAndTicketThresholdsDistinct() throws Exception {
        var report=CiVerdictFixtures.report(mapper);var go=CiVerdictEngine.evaluate(ID,List.of(snapshot(report),snapshot(report)));
        assertEquals("GO",go.outcome());assertEquals(0,go.exitCode());assertNull(go.error());
        report.putObject("summary").putArray("priorities");
        CiVerdictFixtures.finding(report,"http.security.csp","important");
        var important=CiVerdictEngine.evaluate(ID,List.of(snapshot(report),snapshot(report)));
        assertEquals("GO",important.outcome());assertEquals(1,important.confirmedFindings().size());assertTrue(important.confirmedFindings().getFirst().ticketEligible());
        for(String key:List.of("html.title","html.lang","http.security.hsts","http.security.x_frame_options","http.headers.content_type","http.security.cookie_flags"))CiVerdictFixtures.finding(report,key,"important");
        CiVerdictFixtures.finding(report,"lighthouse.score.performance","critical");
        var blocked=CiVerdictEngine.evaluate(ID,List.of(snapshot(report),snapshot(report)));
        assertEquals("SITE_NO_GO",blocked.outcome());assertEquals(1,blocked.exitCode());assertEquals(8,blocked.confirmedFindings().size());
        assertFalse(blocked.confirmedFindings().stream().filter(f->f.key().equals("lighthouse.score.performance")).findFirst().orElseThrow().ticketEligible());
        assertEquals(snapshot(report),CiVerdictEngine.read(mapper.writeValueAsString(snapshot(report)),mapper));
    }
    @Test void unknownIncompleteAntibotTimeoutAndTheOldRuntimeExceptionNeverBecomeGo() {
        List<Consumer<ObjectNode>> corruptions=List.of(
            r->((ObjectNode)r.path("antiBot")).remove("detected"),
            r->((ObjectNode)r.path("antiBot")).put("detected",true),
            r->((ObjectNode)r.path("scores")).putNull("global"),
            r->((ObjectNode)r.path("scores")).put("globalAvailable",false),
            r->((ObjectNode)r.at("/scores/coverage")).put("provisional",true),
            r->((ObjectNode)r.at("/scores/coverage/global")).put("ratio",0.79),
            r->((ObjectNode)r.at("/scores/coverage/domains/0")).put("sufficient",false),
            r->((ArrayNode)r.at("/scores/coverage/checks")).remove(0),
            r->((ObjectNode)r.at("/scores/coverage/checks/0")).put("confidence","UNKNOWN"),
            r->((ObjectNode)r.at("/scores/coverage/checks/0")).put("reason","DEADLINE_EXCEEDED"),
            r->((ObjectNode)r.at("/scores/moduleExecution")).put("completed",7).put("partial",1),
            r->((ObjectNode)r.at("/scores/calculation")).put("scopeFingerprint","synthetic-private-466 ::error::"),
            r->r.withArray("issues").addObject().put("id","zap.alert.unknown").put("severity","critical")
        );
        for(var change:corruptions) {
            var report=CiVerdictFixtures.report(mapper);change.accept(report);
            var result=CiVerdictEngine.evaluate(ID,List.of(snapshot(report),snapshot(report)));
            assertEquals("CONTROL_FAILED",result.outcome());assertTrue(result.confirmedFindings().isEmpty());assertEquals(2,result.exitCode());assertNotNull(result.error());
        }
        var report=CiVerdictFixtures.report(mapper);
        assertEquals(CiErrorCode.VERDICT_POLICY_UNSUPPORTED,CiVerdictEngine.from(report,null).failure());
        ((ObjectNode)report.at("/scores/coverage")).put("version","future");assertEquals(CiErrorCode.VERDICT_POLICY_UNSUPPORTED,snapshot(report).failure());
    }
    @Test void mismatchedFingerprintsSeverityAndOneOffFindingsCannotBeConfirmed() {
        var clean=CiVerdictFixtures.report(mapper);var critical=clean.deepCopy();CiVerdictFixtures.finding(critical,"http.security.csp","critical");
        assertEquals(CiErrorCode.FINDINGS_UNCONFIRMED,CiVerdictEngine.evaluate(ID,List.of(snapshot(clean),snapshot(critical))).error().code());
        var important=clean.deepCopy();CiVerdictFixtures.finding(important,"http.security.csp","important");
        assertEquals(CiErrorCode.FINDINGS_UNCONFIRMED,CiVerdictEngine.evaluate(ID,List.of(snapshot(important),snapshot(critical))).error().code());
        for(String key:List.of("scoringFingerprint","measurementFingerprint","scopeFingerprint")) {
            var changed=clean.deepCopy();((ObjectNode)changed.at("/scores/calculation")).put(key,"d".repeat(64));
            assertEquals(CiErrorCode.REPORTS_INCOMPARABLE,CiVerdictEngine.evaluate(ID,List.of(snapshot(clean),snapshot(changed))).error().code());
        }
        assertEquals(CiErrorCode.CONFIRMATION_REQUIRED,CiVerdictEngine.evaluate(ID,List.of(snapshot(clean))).error().code());
        var weights=clean.deepCopy();((ObjectNode)weights.at("/scores/calculation/configuredDomainWeights")).put("performance",0.4).put("security",0.1);
        assertEquals(CiErrorCode.REPORTS_INCOMPARABLE,CiVerdictEngine.evaluate(ID,List.of(snapshot(clean),snapshot(weights))).error().code());
        var population=clean.deepCopy();((ObjectNode)population.at("/scores/coverage/checks/0")).put("state","NOT_APPLICABLE").put("confidence","UNKNOWN").put("reason","CONDITIONAL_SIGNAL_ABSENT");
        assertEquals(CiErrorCode.REPORTS_INCOMPARABLE,CiVerdictEngine.evaluate(ID,List.of(snapshot(clean),snapshot(population))).error().code());
        var invented=clean.deepCopy();for(var check:invented.at("/scores/coverage/checks"))((ObjectNode)check).put("state","UNAVAILABLE").put("confidence","UNKNOWN");
        assertEquals(CiErrorCode.MEASUREMENT_INCOMPLETE,snapshot(invented).failure());
        ((ObjectNode)clean.path("scores")).put("global",0);assertEquals(0,snapshot(clean).globalScore());
        var lower=clean.deepCopy();((ObjectNode)lower.path("scores")).put("global",1);
        assertEquals("GO",CiVerdictEngine.evaluate(ID,List.of(snapshot(clean),snapshot(lower))).outcome()); // No invented score-regression gate.
    }
    @Test void rejectsConflictingDuplicatesAndLowConfidenceInsteadOfSilentlyDroppingThem() {
        var report=CiVerdictFixtures.report(mapper);CiVerdictFixtures.finding(report,"http.security.csp","critical");CiVerdictFixtures.finding(report,"http.security.csp","important");
        assertEquals(CiErrorCode.MEASUREMENT_INCOMPLETE,snapshot(report).failure());
        report.withArray("issues").removeAll();CiVerdictFixtures.finding(report,"http.security.csp","critical");((ObjectNode)report.at("/issues/0")).put("confidence","LOW");
        assertEquals(CiErrorCode.MEASUREMENT_INCOMPLETE,snapshot(report).failure());
    }
    @Test void snapshotsContainOnlyBoundedEvidenceAndPolicyIsFrozenAcrossJavaAndTheBff() throws Exception {
        var report=CiVerdictFixtures.report(mapper);report.put("url","https://example.com/private?q=synthetic-private-466");
        CiVerdictFixtures.finding(report,"http.security.csp","critical");((ObjectNode)report.at("/issues/0")).put("title","synthetic-private-466 @everyone ::error::");
        var value=snapshot(report);var json=mapper.valueToTree(value);assertFalse(json.toString().contains("synthetic-private-466"));
        var injected=json.deepCopy();((ObjectNode)injected).put("raw","synthetic-private-466");assertThrows(IllegalArgumentException.class,()->CiVerdictEngine.read(injected.toString(),mapper));
        ((ObjectNode)json.at("/findings/0")).put("ticketEligible",false);assertThrows(IllegalArgumentException.class,()->CiVerdictEngine.read(json.toString(),mapper));
        assertThrows(IllegalArgumentException.class,()->CiVerdictEngine.read(" ".repeat(CiVerdictEngine.MAX_BYTES+1),mapper));
        var policy=mapper.valueToTree(CiVerdictPolicy.STANDARD);
        assertEquals(policy,mapper.readTree(Path.of("../console-web/src/lib/ci-verdict-policy-v1.json").toFile()));
        assertTrue(CiVerdictPolicy.matches(policy.toString(),mapper));((ObjectNode)policy).put("minimumCoverage",0.1);assertFalse(CiVerdictPolicy.matches(policy.toString(),mapper));
        assertFalse(CiVerdictPolicy.matches(null,mapper));
    }
}
