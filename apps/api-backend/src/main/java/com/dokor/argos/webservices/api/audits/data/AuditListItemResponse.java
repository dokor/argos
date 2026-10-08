package com.dokor.argos.webservices.api.audits.data;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(name = "AuditListItemResponse")
public record AuditListItemResponse(
    @JsonSerialize(using = ToStringSerializer.class)
    @Schema(example = "10")
    long auditId,
    @Schema(example = "example.com")
    String hostname,
    @Schema(example = "https://example.com")
    String inputUrl,
    @Schema(example = "https://example.com/")
    String normalizedUrl,

    @Schema(example = "42")
    @JsonSerialize(using = ToStringSerializer.class)
    long runId,
    @Schema(example = "QUEUED")
    String status,

    Instant createdAt,
    Instant finishedAt,

    @Schema(example = "https://example.com/")
    String reportUrl,

    /** Published score, or null for unavailable and pre-migration reports. */
    Integer globalScore
) {
}
