package com.dokor.argos.services.ci;

import com.dokor.argos.services.analysis.scoring.DefaultScorePolicy;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CiExportProjectionTest {
    private final ObjectMapper mapper=new ObjectMapper();
    private final DefaultScorePolicy policy=new DefaultScorePolicy();
    @Test void dropsAllTargetTextAndUnknownKeysAndUsesCanonicalFindingIdentity() throws Exception {
        var report=mapper.createObjectNode();
        String hostile="synthetic-private-marker @everyone ![image](https://attacker.example/x) ::error:: injected \u001b[31m";
        report.put("url","https://example.com/private?token="+hostile);report.put("console",hostile);report.put("authorization",hostile);
        var issues=report.putArray("issues");
        for(String key:List.of("http.security.csp","http.security.csp","html.title","zap.alert."+hostile,hostile)) {
            var item=issues.addObject();item.put("id",key);item.put("categoryKey",hostile);
            item.put("severity","critical");item.put("title",hostile);item.put("evidence",hostile);item.put("recommendation",hostile);
        }
        var checks=report.putObject("scores").putObject("coverage").putArray("checks");
        checks.addObject().put("key","http.security.csp").put("domain",hostile).put("state","MEASURED").put("evidence",hostile);
        checks.addObject().put("key",hostile).put("state","MEASURED");
        var value=CiExportProjection.from(report);
        assertEquals(2,value.findings().size());assertEquals(2,value.omittedFindings());
        assertEquals(List.of(new CiExportProjection.Check("http.security.csp","security","MEASURED")),value.checks());
        String json=mapper.writeValueAsString(value);assertFalse(json.contains("synthetic-private-marker"));assertFalse(json.contains("everyone"));assertFalse(json.contains("https:"));
        assertEquals(value,CiExportProjection.read(json,mapper));
        assertFalse(mapper.writeValueAsString(CiAdmissionService.PUBLIC_ISSUE).contains("security.csp"));
    }
    @Test void rejectsTamperedProjectionEvenWhenStringLooksLikeACatalogueKey() throws Exception {
        var safe=mapper.valueToTree(CiExportProjection.from(mapper.readTree("{\"issues\":[]}")));
        for(String field:List.of("evidence","html","Authorization")) {
            var injected=safe.deepCopy();((com.fasterxml.jackson.databind.node.ObjectNode)injected).put(field,"synthetic-private-marker");
            assertThrows(IllegalArgumentException.class,()->CiExportProjection.read(injected.toString(),mapper));
        }
        for(String key:List.of("http.security.fake","@everyone","::error::","html.title?s=synthetic-private-marker")) {
            var injected=safe.deepCopy();((com.fasterxml.jackson.databind.node.ArrayNode)injected.path("findings")).addObject().put("key",key).put("category","security").put("severity","critical");
            assertThrows(IllegalArgumentException.class,()->CiExportProjection.read(injected.toString(),mapper));
        }
        assertThrows(IllegalArgumentException.class,()->CiExportProjection.read(" ".repeat(CiExportProjection.MAX_BYTES+1),mapper));
    }
    @Test void frontendAndFrozenCatalogueMatchTheReviewedExactScoringKeys() throws Exception {
        var expected=new TreeMap<String,String>();
        for(String key:policy.cataloguedKeys()) {
            String category=policy.ruleFor(null,key).businessCategory().tag();
            if(Set.of("performance","security","seo","a11y").contains(category))expected.put(key,category);
        }
        assertEquals(expected,CiExportProjection.catalogue());
        assertTrue(expected.size()<CiExportProjection.MAX_FINDINGS);assertTrue(expected.size()<CiExportProjection.MAX_CHECKS);
        var frontend=mapper.readTree(Path.of("../console-web/src/lib/ci-export-catalog-v1.json").toFile());
        assertEquals(mapper.valueToTree(expected),frontend);
    }
}
