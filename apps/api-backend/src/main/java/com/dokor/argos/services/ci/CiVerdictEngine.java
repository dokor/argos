package com.dokor.argos.services.ci;

import com.dokor.argos.services.ci.errors.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.*;
import java.util.*;

/** Pure evaluation of frozen, private evidence. No DNS, audit, ledger or publisher mutation. */
public final class CiVerdictEngine {
    public static final int MAX_BYTES=32768;
    private static final Set<String> DOMAINS=Set.of("performance","security","seo","a11y");
    private static final com.dokor.argos.services.analysis.scoring.DefaultScorePolicy SCORE_POLICY=new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy();
    private static final Set<String> REQUIRED_CHECKS=SCORE_POLICY.cataloguedKeys().stream()
        .filter(key->SCORE_POLICY.ruleFor(null,key).applicability().contributesToScore() && SCORE_POLICY.ruleFor(null,key).weight()>0)
        .collect(java.util.stream.Collectors.toUnmodifiableSet());
    private static final Set<CiErrorCode> FAILURES=Set.of(CiErrorCode.MEASUREMENT_INCOMPLETE,CiErrorCode.ANTIBOT_DETECTED,
        CiErrorCode.COLLECTION_TIMEOUT,CiErrorCode.VERDICT_POLICY_UNSUPPORTED);
    public record Fingerprints(String scoring,String measurement,String scope,String evidence) {}
    public record Finding(String key,String category,String severity,boolean ticketEligible) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Snapshot(int version,CiErrorCode failure,Integer globalScore,Fingerprints fingerprints,List<Finding> findings) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Verdict(int apiVersion,String kind,String admissionId,String policyId,String policyFingerprint,int sampleCount,
                          String outcome,int exitCode,CiErrors.Error error,Fingerprints fingerprints,List<Finding> confirmedFindings) {}
    private CiVerdictEngine() {}
    private static boolean hash(JsonNode value){return value.isTextual() && value.asText().matches("[a-f0-9]{64}");}
    private static boolean number(JsonNode value,double min,double max){return value.isNumber() && Double.isFinite(value.doubleValue()) && value.doubleValue()>=min && value.doubleValue()<=max;}
    private static boolean yes(JsonNode value){return value.isBoolean() && value.booleanValue();}
    private static boolean no(JsonNode value){return value.isBoolean() && !value.booleanValue();}
    private static boolean count(JsonNode value,int expected){return value.isInt() && value.intValue()==expected;}
    private static void require(boolean valid,CiErrorCode code){if(!valid)throw new Rejected(code);}
    private static final class Rejected extends RuntimeException {final CiErrorCode code;Rejected(CiErrorCode code){this.code=code;}}
    public static Snapshot from(JsonNode report,String measurementVersion) {
        try {
            var policy=CiVerdictPolicy.STANDARD;var scores=report.path("scores");var coverage=scores.path("coverage");var calculation=scores.path("calculation");
            require(policy.coverageVersion().equals(coverage.path("version").asText())
                && count(calculation.path("scoringVersion"),policy.scoringVersion()) && policy.measurementVersion().equals(measurementVersion),CiErrorCode.VERDICT_POLICY_UNSUPPORTED);
            require(report.path("antiBot").path("detected").isBoolean(),CiErrorCode.MEASUREMENT_INCOMPLETE);
            require(no(report.path("antiBot").path("detected")),CiErrorCode.ANTIBOT_DETECTED);
            require(coverage.path("checks").isArray() && coverage.path("checks").size()<=256,CiErrorCode.MEASUREMENT_INCOMPLETE);
            for(var check:coverage.path("checks"))require(!"DEADLINE_EXCEEDED".equals(check.path("reason").asText()),CiErrorCode.COLLECTION_TIMEOUT);
            var execution=scores.path("moduleExecution");
            require(count(execution.path("total"),8) && count(execution.path("completed"),8)
                && List.of("partial","failed","skipped","pending","running").stream().allMatch(key->count(execution.path(key),0)),CiErrorCode.MEASUREMENT_INCOMPLETE);
            require(yes(scores.path("globalAvailable")) && scores.path("global").isInt() && number(scores.path("global"),0,100)
                && no(coverage.path("provisional")) && number(coverage.path("threshold"),policy.minimumCoverage(),policy.minimumCoverage()),CiErrorCode.MEASUREMENT_INCOMPLETE);
            require(aggregate(coverage.path("global")),CiErrorCode.MEASUREMENT_INCOMPLETE);
            var domains=new HashSet<String>();
            require(coverage.path("domains").isArray() && coverage.path("domains").size()==4,CiErrorCode.MEASUREMENT_INCOMPLETE);
            for(var domain:coverage.path("domains"))require(DOMAINS.contains(domain.path("key").asText()) && domains.add(domain.path("key").asText()) && aggregate(domain),CiErrorCode.MEASUREMENT_INCOMPLETE);
            require(hash(calculation.path("scoringFingerprint")) && hash(calculation.path("measurementFingerprint")) && hash(calculation.path("scopeFingerprint")),CiErrorCode.MEASUREMENT_INCOMPLETE);
            var checks=new HashMap<String,JsonNode>();
            for(var check:coverage.path("checks")) {
                String key=check.path("key").asText();
                require(checks.putIfAbsent(key,check)==null && CiExportProjection.catalogue().containsKey(key)
                    && CiExportProjection.catalogue().get(key).equals(check.path("domain").asText())
                    && Set.of("MEASURED","UNAVAILABLE","BLOCKED_BY_ANTIBOT","NOT_APPLICABLE").contains(check.path("state").asText())
                    && number(check.path("weight"),SCORE_POLICY.ruleFor(null,key).weight(),SCORE_POLICY.ruleFor(null,key).weight()),CiErrorCode.MEASUREMENT_INCOMPLETE);
                if("MEASURED".equals(check.path("state").asText()))require("MEASURED".equals(check.path("confidence").asText()),CiErrorCode.MEASUREMENT_INCOMPLETE);
                if("NOT_APPLICABLE".equals(check.path("state").asText()))require(check.path("reason").isTextual() && check.path("reason").asText().matches("[A-Z_]{1,96}"),CiErrorCode.MEASUREMENT_INCOMPLETE);
            }
            require(checks.keySet().equals(REQUIRED_CHECKS),CiErrorCode.MEASUREMENT_INCOMPLETE);
            require(weightedCoverage(checks.values(),coverage.path("global")),CiErrorCode.MEASUREMENT_INCOMPLETE);
            for(var domain:coverage.path("domains"))require(weightedCoverage(checks.values().stream().filter(check->check.path("domain").asText().equals(domain.path("key").asText())).toList(),domain),CiErrorCode.MEASUREMENT_INCOMPLETE);
            String evidence=configurationFingerprint(calculation,checks);
            require(report.path("issues").isArray() && report.path("issues").size()<=256,CiErrorCode.MEASUREMENT_INCOMPLETE);
            var inventory=new TreeMap<String,Finding>();var severities=new HashMap<String,String>();
            // Inventory, not the top-six priorities. Conflicting duplicates cannot hide a defect.
            for(var issue:report.path("issues")) {
                String key=issue.path("id").asText(),category=CiExportProjection.catalogue().get(key),severity=issue.path("severity").asText();
                require(category!=null && category.equals(issue.path("categoryKey").asText())
                    && Set.of("critical","important","info").contains(severity),CiErrorCode.MEASUREMENT_INCOMPLETE);
                String earlier=severities.putIfAbsent(key,severity);require(earlier==null || earlier.equals(severity),CiErrorCode.MEASUREMENT_INCOMPLETE);
                if(severity.equals("info"))continue;
                var check=checks.get(key);
                require(check!=null && "MEASURED".equals(check.path("state").asText()) && !"LOW".equals(issue.path("confidence").asText()),CiErrorCode.MEASUREMENT_INCOMPLETE);
                var value=new Finding(key,category,severity,policy.eligibleTicketKeys().contains(key));
                var previous=inventory.putIfAbsent(key,value);require(previous==null || previous.equals(value),CiErrorCode.MEASUREMENT_INCOMPLETE);
            }
            var fingerprints=new Fingerprints(calculation.path("scoringFingerprint").asText(),calculation.path("measurementFingerprint").asText(),calculation.path("scopeFingerprint").asText(),evidence);
            return new Snapshot(1,null,scores.path("global").intValue(),fingerprints,List.copyOf(inventory.values()));
        }catch(Rejected rejected){return new Snapshot(1,rejected.code,null,null,List.of());}
        catch(RuntimeException invalid){return new Snapshot(1,CiErrorCode.MEASUREMENT_INCOMPLETE,null,null,List.of());}
    }
    private static boolean aggregate(JsonNode value) {
        return yes(value.path("available")) && yes(value.path("sufficient")) && number(value.path("ratio"),CiVerdictPolicy.STANDARD.minimumCoverage(),1);
    }
    private static boolean weightedCoverage(Collection<JsonNode> checks,JsonNode aggregate) {
        double expected=checks.stream().filter(c->!"NOT_APPLICABLE".equals(c.path("state").asText())).mapToDouble(c->c.path("weight").doubleValue()).sum();
        double measured=checks.stream().filter(c->"MEASURED".equals(c.path("state").asText())).mapToDouble(c->c.path("weight").doubleValue()).sum();
        return expected>0 && measured/expected>=CiVerdictPolicy.STANDARD.minimumCoverage() && Math.abs(measured/expected-aggregate.path("ratio").doubleValue())<1e-9;
    }
    /** Bind the available measurement population and all effective/configured domain weights. */
    private static String configurationFingerprint(JsonNode calculation,Map<String,JsonNode> checks) {
        var configured=calculation.path("configuredDomainWeights");
        exact(configured,DOMAINS);var weights=new TreeMap<String,Double>();
        for(String key:DOMAINS){require(number(configured.path(key),0.000001,1),CiErrorCode.MEASUREMENT_INCOMPLETE);weights.put(key,configured.path(key).doubleValue());}
        require(Math.abs(weights.values().stream().mapToDouble(Double::doubleValue).sum()-1)<1e-9,CiErrorCode.MEASUREMENT_INCOMPLETE);
        var domains=new TreeMap<String,List<Double>>();
        require(calculation.path("domains").isArray() && calculation.path("domains").size()==4,CiErrorCode.MEASUREMENT_INCOMPLETE);
        for(var domain:calculation.path("domains")) {
            String key=domain.path("key").asText();require(DOMAINS.contains(key) && !domains.containsKey(key)
                && number(domain.path("maxScore"),0.000001,1000000) && number(domain.path("effectiveWeight"),0.000001,1),CiErrorCode.MEASUREMENT_INCOMPLETE);
            domains.put(key,List.of(domain.path("maxScore").doubleValue(),domain.path("effectiveWeight").doubleValue()));
        }
        var population=new TreeMap<String,List<Object>>();
        checks.forEach((key,value)->population.put(key,List.of(value.path("domain").asText(),value.path("state").asText(),value.path("confidence").asText(),value.path("weight").doubleValue())));
        try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(new ObjectMapper().writeValueAsBytes(List.of(weights,domains,population))));}
        catch(Exception unavailable){throw new IllegalStateException("CI measurement signature unavailable");}
    }
    public static Snapshot read(String json,ObjectMapper mapper) {
        try {
            if(json==null || json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>MAX_BYTES)throw new IllegalArgumentException();
            var node=mapper.readTree(json);exact(node,Set.of("version","failure","globalScore","fingerprints","findings"));
            if(!count(node.path("version"),1) || !node.path("findings").isArray() || node.path("findings").size()>128)throw new IllegalArgumentException();
            var value=mapper.treeToValue(node,Snapshot.class);
            if(value.failure()!=null) {
                if(!FAILURES.contains(value.failure()) || value.globalScore()!=null || value.fingerprints()!=null || !value.findings().isEmpty())throw new IllegalArgumentException();
            }else {
                if(!node.path("globalScore").isInt() || !number(node.path("globalScore"),0,100))throw new IllegalArgumentException();
                exact(node.path("fingerprints"),Set.of("scoring","measurement","scope","evidence"));
                for(String key:List.of("scoring","measurement","scope","evidence"))if(!hash(node.path("fingerprints").path(key)))throw new IllegalArgumentException();
                var seen=new HashSet<String>();
                for(var item:node.path("findings")) {
                    exact(item,Set.of("key","category","severity","ticketEligible"));String key=item.path("key").asText();
                    if(!CiExportProjection.catalogue().containsKey(key) || !CiExportProjection.catalogue().get(key).equals(item.path("category").asText()) || !seen.add(key)
                        || !Set.of("critical","important").contains(item.path("severity").asText()) || !item.path("ticketEligible").isBoolean()
                        || item.path("ticketEligible").booleanValue()!=CiVerdictPolicy.STANDARD.eligibleTicketKeys().contains(key))throw new IllegalArgumentException();
                }
            }
            return value;
        }catch(Exception invalid){throw new IllegalArgumentException("CI verdict evidence unavailable");}
    }
    private static void exact(JsonNode value,Set<String> fields){if(!value.isObject() || value.size()!=fields.size())throw new IllegalArgumentException();var names=value.fieldNames();while(names.hasNext())if(!fields.contains(names.next()))throw new IllegalArgumentException();}
    public static Verdict failure(String admissionId,int count,CiErrorCode code) {
        return new Verdict(1,"verdict-v1",admissionId,CiVerdictPolicy.STANDARD.policyId(),CiVerdictPolicy.STANDARD.fingerprint(),count,
            "CONTROL_FAILED",2,CiErrors.create(code,null).error(),null,List.of());
    }
    public static Verdict evaluate(String admissionId,List<Snapshot> values) {
        if(values.size()!=2)return failure(admissionId,values.size(),CiErrorCode.CONFIRMATION_REQUIRED);
        for(var value:values)if(value.failure()!=null)return failure(admissionId,2,value.failure());
        var first=values.getFirst();var second=values.getLast();
        if(!first.fingerprints().equals(second.fingerprints()))return failure(admissionId,2,CiErrorCode.REPORTS_INCOMPARABLE);
        if(!new HashSet<>(first.findings()).equals(new HashSet<>(second.findings())))return failure(admissionId,2,CiErrorCode.FINDINGS_UNCONFIRMED);
        var confirmed=first.findings().stream().sorted(Comparator.comparing(Finding::key)).toList();
        boolean blocked=confirmed.stream().anyMatch(value->value.severity().equals("critical"));
        return new Verdict(1,"verdict-v1",admissionId,CiVerdictPolicy.STANDARD.policyId(),CiVerdictPolicy.STANDARD.fingerprint(),2,
            blocked?"SITE_NO_GO":"GO",blocked?1:0,null,first.fingerprints(),confirmed);
    }
}
