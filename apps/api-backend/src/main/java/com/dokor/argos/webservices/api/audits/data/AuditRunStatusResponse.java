package com.dokor.argos.webservices.api.audits.data;


import com.dokor.argos.services.domain.enums.AuditRunStatus;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

public record AuditRunStatusResponse(
    long runId,
    AuditRunStatus status,
    LocalDateTime createdAt,
    LocalDateTime startedAt,
    LocalDateTime finishedAt,
    String lastError
) {
}
