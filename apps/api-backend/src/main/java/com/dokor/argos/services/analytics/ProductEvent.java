package com.dokor.argos.services.analytics;
import java.util.Set;
public record ProductEvent(String event, AnalyticsDimensions dimensions, String errorCategory) {
    public ProductEvent {
        if(event==null || !Set.of("public_page_view","example_open","audit_cta_click","audit_submission_rejected","account_registration_view","account_auth_rejected").contains(event) || dimensions==null) throw new IllegalArgumentException("Invalid product event");
        if(errorCategory==null) errorCategory="none";
        if(!Set.of("none","validation","service","rate_limit").contains(errorCategory)) throw new IllegalArgumentException("Invalid error category");
        if(!Set.of("audit_submission_rejected","account_auth_rejected").contains(event) && !errorCategory.equals("none")) throw new IllegalArgumentException("Error category is only for rejected submissions");
    }
}
