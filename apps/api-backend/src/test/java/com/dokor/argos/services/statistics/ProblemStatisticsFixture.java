package com.dokor.argos.services.statistics;

import com.dokor.argos.services.analysis.scoring.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Controlled frozen report with all catalogue coverage states; contains deliberately private source text. */
public final class ProblemStatisticsFixture {
    public static final String KEY="http.security.csp";
    public static final ScorePolicy POLICY=new DefaultScorePolicy();
    public static ObjectNode report(boolean affected, boolean partial) {
        var mapper=new ObjectMapper(); var report=mapper.createObjectNode();
        report.put("url","https://private.example/secret?token=private");
        var scores=report.putObject("scores");
        scores.putObject("calculation").put("scoringVersion",POLICY.version()).put("scoringFingerprint",POLICY.fingerprint());
        var coverage=scores.putObject("coverage");
        coverage.put("version",MeasurementCoverageService.VERSION).put("provisional",partial);
        coverage.putObject("global").put("ratio",partial?.6:1);
        var checks=coverage.putArray("checks");
        for(var key:POLICY.cataloguedKeys()) {
            var rule=POLICY.ruleFor(null,key);
            if(!rule.applicability().contributesToScore() || rule.weight()<=0 || rule.businessCategory()==BusinessCategory.NONE)continue;
            checks.addObject().put("key",key).put("domain",rule.businessCategory().tag())
                .put("weight",rule.weight()).put("state",partial&&!KEY.equals(key)?"UNAVAILABLE":"MEASURED");
        }
        var issues=report.putArray("issues");
        if(affected) issues.addObject().put("id",KEY).put("categoryKey","security").put("severity","important")
            .put("title","Private example site").put("evidence","https://private.example/secret");
        return report;
    }
    private ProblemStatisticsFixture() {}
}
