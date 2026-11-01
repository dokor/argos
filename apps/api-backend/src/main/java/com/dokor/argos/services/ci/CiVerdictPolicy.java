package com.dokor.argos.services.ci;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.security.MessageDigest;

/** Immutable reviewed policy; changes require a new policy ID, never a silent edit. */
public final class CiVerdictPolicy {
    public record Policy(int apiVersion,String kind,String profileId,String policyId,int requiredSamples,
                         String coverageVersion,double minimumCoverage,int scoringVersion,String measurementVersion,
                         String pipelineSeverity,List<String> ticketSeverities,List<String> eligibleTicketKeys,
                         boolean historicalComparison,List<String> exceptions,String fingerprint) {}
    private static final ObjectMapper MAPPER=new ObjectMapper();
    public static final Policy STANDARD=load();
    private CiVerdictPolicy() {}
    private static Policy load() {
        try(var in=CiVerdictPolicy.class.getResourceAsStream("/ci/verdict-policy-v1.json")) {
            var tree=(com.fasterxml.jackson.databind.node.ObjectNode)MAPPER.readTree(in);
            var claimed=tree.remove("fingerprint").asText();
            String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(MAPPER.writeValueAsBytes(tree)));
            if(!hash.equals(claimed))throw new IllegalArgumentException();
            tree.put("fingerprint",hash);return MAPPER.treeToValue(tree,Policy.class);
        }catch(Exception invalid){throw new IllegalStateException("CI verdict policy unavailable");}
    }
    public static boolean matches(String json,ObjectMapper mapper) {
        try{return json!=null && json.length()<=8192 && mapper.readTree(json).equals(mapper.valueToTree(STANDARD));}
        catch(Exception invalid){return false;}
    }
}
