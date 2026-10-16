package com.dokor.argos.services.analytics;
import java.util.Set;
import com.fasterxml.jackson.annotation.JsonAnySetter;
public record TrafficEvent(String route,String lang,String source,boolean visit) {
    public TrafficEvent {
        new AnalyticsDimensions(route,lang,"page");
        if(source==null||!Set.of("direct","search","referral","campaign","internal").contains(source))throw new IllegalArgumentException("Invalid traffic source");
    }
    @JsonAnySetter public void unknown(String name,Object value){throw new IllegalArgumentException("Invalid traffic field");}
}
