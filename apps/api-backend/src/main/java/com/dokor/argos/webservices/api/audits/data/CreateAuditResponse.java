package com.dokor.argos.webservices.api.audits.data;

import com.dokor.argos.services.domain.enums.AuditRunStatus;

public record CreateAuditResponse(
    long auditId,
    long runId,
    AuditRunStatus status
) {
}
