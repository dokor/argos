package com.dokor.argos.webservices.api.audits.data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateAuditRequest(
    @NotBlank
    @Size(max = 2048, message = "URL must not exceed 2048 characters")
    String url, com.dokor.argos.services.analytics.AnalyticsDimensions analytics,
    com.dokor.argos.services.analysis.AuditScope scope
) {
    public CreateAuditRequest(String url) { this(url,null,null); }
    public CreateAuditRequest(String url, com.dokor.argos.services.analytics.AnalyticsDimensions analytics) { this(url,analytics,null); }
}
