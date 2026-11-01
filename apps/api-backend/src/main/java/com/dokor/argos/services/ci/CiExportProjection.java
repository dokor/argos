package com.dokor.argos.services.ci;

import com.dokor.argos.services.connected.summary.CanonicalFindings;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.*;
import java.util.*;

/**
 * Versioned private export: only catalogue identities, enumerations and bounded numbers cross
 * this boundary. No target-derived text, URLs, evidence, AI output or collector diagnostics.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record CiExportProjection(int version, List<Category> categories, List<Check> checks,
                                 List<Finding> findings, int omittedFindings) {
    public static final int MAX_BYTES=49152, MAX_FINDINGS=128, MAX_CHECKS=256;
    private static final Set<String> DOMAINS=Set.of("performance","security","seo","a11y");
    private static final Set<String> STATES=Set.of("MEASURED","UNAVAILABLE","BLOCKED_BY_ANTIBOT","NOT_APPLICABLE");
    private static final Set<String> SEVERITIES=Set.of("critical","important","info");
    private static final Map<String,String> CATALOG=catalog();
    public static Map<String,String> catalogue(){return CATALOG;}
    private static Map<String,String> catalog() {
        try(var stream=CiExportProjection.class.getResourceAsStream("/ci/export-catalog-v1.json")) {
            return Map.copyOf(new ObjectMapper().readValue(stream,new com.fasterxml.jackson.core.type.TypeReference<Map<String,String>>(){}));
        }catch(Exception invalid){throw new IllegalStateException("CI export catalogue unavailable");}
    }
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Category(String key,Integer score) {}
    public record Check(String key,String category,String state) {}
    public record Finding(String key,String category,String severity) {}

    public static CiExportProjection from(JsonNode report) {
        var categories=new TreeMap<String,Category>();
        for(var item:report.path("scores").path("byCategory")) {
            String key=item.path("key").asText();
            var score=item.path("score");
            if(DOMAINS.contains(key) && score.isIntegralNumber() && score.canConvertToInt() && score.intValue()>=0 && score.intValue()<=100)
                categories.putIfAbsent(key,new Category(key,score.intValue()));
        }
        var checks=new TreeMap<String,Check>();
        for(var item:report.path("scores").path("coverage").path("checks")) {
            String key=item.path("key").asText(),category=category(key),state=item.path("state").asText();
            if(category!=null && STATES.contains(state))checks.putIfAbsent(key,new Check(key,category,state));
        }
        var findings=new TreeMap<String,Finding>();int omitted=0;
        for(var item:CanonicalFindings.from(report)) {
            String key=item.path("id").asText(),category=category(key),severity=item.path("severity").asText();
            if(category==null || !SEVERITIES.contains(severity)){omitted++;continue;}
            findings.putIfAbsent(key,new Finding(key,category,severity));
        }
        int extra=Math.max(0,findings.size()-MAX_FINDINGS);
        return new CiExportProjection(1,List.copyOf(categories.values()),checks.values().stream().limit(MAX_CHECKS).toList(),
            findings.values().stream().limit(MAX_FINDINGS).toList(),omitted+extra);
    }
    private static String category(String key) {
        // An exact server catalogue key, never a pattern/prefix accepted from a target.
        if(!CATALOG.containsKey(key) || !key.matches("[a-z0-9_.-]{1,96}"))return null;
        String category=CATALOG.get(key);
        return DOMAINS.contains(category)?category:null;
    }
    /** Reject tampered/old projections instead of silently forwarding any extra field or string. */
    public static CiExportProjection read(String json,ObjectMapper mapper) {
        try {
            if(json==null || json.length()>MAX_BYTES || json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>MAX_BYTES)throw new IllegalArgumentException();
            JsonNode root=mapper.readTree(json);
            exact(root,Set.of("version","categories","checks","findings","omittedFindings"));
            if(!root.path("version").isInt() || root.path("version").intValue()!=1 || !root.path("omittedFindings").isInt() || root.path("omittedFindings").intValue()<0)throw new IllegalArgumentException();
            array(root.path("categories"),4);array(root.path("checks"),MAX_CHECKS);array(root.path("findings"),MAX_FINDINGS);
            var seen=new HashSet<String>();
            for(var item:root.path("categories")) {
                exact(item,Set.of("key","score"));
                if(!DOMAINS.contains(item.path("key").asText()) || !seen.add(item.path("key").asText()) ||
                    !(item.path("score").isNull() || item.path("score").isInt() && item.path("score").intValue()>=0 && item.path("score").intValue()<=100))throw new IllegalArgumentException();
            }
            for(String field:List.of("checks","findings")) {
                seen.clear();
                for(var item:root.path(field)) {
                    boolean check=field.equals("checks");
                    exact(item,check?Set.of("key","category","state"):Set.of("key","category","severity"));
                    String key=item.path("key").asText(),category=category(key);
                    if(category==null || !seen.add(key) || !category.equals(item.path("category").asText()) ||
                        !(check?STATES:SEVERITIES).contains(item.path(check?"state":"severity").asText()))throw new IllegalArgumentException();
                }
            }
            return mapper.treeToValue(root,CiExportProjection.class);
        }catch(Exception invalid){throw new IllegalArgumentException("CI export projection unavailable");}
    }
    private static void exact(JsonNode node,Set<String> fields) {
        if(!node.isObject() || node.size()!=fields.size())throw new IllegalArgumentException();
        var names=node.fieldNames();while(names.hasNext())if(!fields.contains(names.next()))throw new IllegalArgumentException();
    }
    private static void array(JsonNode node,int max){if(!node.isArray() || node.size()>max)throw new IllegalArgumentException();}
}
