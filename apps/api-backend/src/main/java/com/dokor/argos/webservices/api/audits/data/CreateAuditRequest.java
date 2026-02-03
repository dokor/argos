package com.dokor.argos.webservices.api.audits.data;

import jakarta.validation.constraints.NotBlank;

public record CreateAuditRequest(
    @NotBlank
    String url
) {}
