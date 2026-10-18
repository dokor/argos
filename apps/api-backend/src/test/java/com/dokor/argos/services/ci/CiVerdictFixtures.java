package com.dokor.argos.services.ci;
import com.dokor.argos.services.analysis.scoring.DefaultScorePolicy;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
/** Synthetic measurements only; no network or real target is involved. */
public final class CiVerdictFixtures {
    public static ObjectNode report(ObjectMapper mapper) {
        var r=mapper.createObjectNode();r.putArray("issues");r.putObject("antiBot").put("detected",false);
        var s=r.putObject("scores");s.put("global",85).put("globalAvailable",true);
        s.putObject("moduleExecution").put("total",8).put("completed",8).put("partial",0).put("failed",0).put("skipped",0).put("pending",0).put("running",0);
        s.putObject("calculation").put("scoringVersion",13).put("scoringFingerprint","a".repeat(64)).put("measurementFingerprint","b".repeat(64)).put("scopeFingerprint","c".repeat(64));
        var c=s.putObject("coverage");c.put("version","weighted-coverage-v3").put("threshold",0.8).put("provisional",false);
        aggregate(c.putObject("global"));var domains=c.putArray("domains");
        for(String key:List.of("performance","security","seo","a11y"))aggregate(domains.addObject().put("key",key));
        var checks=c.putArray("checks");var policy=new DefaultScorePolicy();
        for(String key:new TreeSet<>(policy.cataloguedKeys())) {
            var rule=policy.ruleFor(null,key);
            if(rule.applicability().contributesToScore() && rule.weight()>0)checks.addObject().put("key",key).put("domain",rule.businessCategory().tag()).put("state","MEASURED").put("confidence","MEASURED");
        }
        return r;
    }
    private static void aggregate(ObjectNode node){node.put("available",true).put("sufficient",true).put("ratio",1);}
    public static void finding(ObjectNode report,String key,String severity) {
        report.withArray("issues").addObject().put("id",key).put("categoryKey",CiExportProjection.catalogue().get(key)).put("severity",severity).put("confidence","UNKNOWN");
    }
    private CiVerdictFixtures() {}
}
