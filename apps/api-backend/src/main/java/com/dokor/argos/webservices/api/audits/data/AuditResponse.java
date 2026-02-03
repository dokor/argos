package com.dokor.argos.webservices.api.audits.data;

import java.time.OffsetDateTime;

public record AuditResponse(
    long auditId,
    String inputUrl,
    String normalizedUrl,
    String hostname,
    OffsetDateTime createdAt
) {
}
