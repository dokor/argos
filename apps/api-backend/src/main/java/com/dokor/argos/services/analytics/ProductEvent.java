package com.dokor.argos.services.analytics;
import java.util.Set;
public record ProductEvent(String event, AnalyticsDimensions dimensions, String errorCategory) {
    public ProductEvent {
        if(!Set.of("public_page_view","example_open","audit_cta_click","audit_submission_rejected").contains(event) || dimensions==null) throw new IllegalArgumentException("Invalid product event");
        if(errorCategory==null) errorCategory="none";
        if(!Set.of("none","validation","service","rate_limit").contains(errorCategory)) throw new IllegalArgumentException("Invalid error category");
        if(!event.equals("audit_submission_rejected") && !errorCategory.equals("none")) throw new IllegalArgumentException("Error category is only for rejected submissions");
    }
}
