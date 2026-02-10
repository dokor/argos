package com.dokor.argos.webservices.api.audits.data;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Current status of an audit run")
public record AuditRunStatusResponse(

    @Schema(description = "Identifier of the audit run", example = "42")
    @JsonSerialize(using = ToStringSerializer.class)
    long runId,

    @Schema(description = "Identifier of the related audit", example = "12")
    @JsonSerialize(using = ToStringSerializer.class)
    long auditId,

    @Schema(description = "Current status of the audit run", example = "RUNNING")
    String status,

    @Schema(description = "Run creation timestamp")
    Instant createdAt,

    @Schema(description = "Timestamp when processing started", nullable = true)
    Instant startedAt,

    @Schema(description = "Timestamp when processing finished", nullable = true)
    Instant finishedAt,

    @Schema(description = "Error message if the run failed", nullable = true)
    String lastError,

    @Schema(description = "Result payload if the run completed successfully", nullable = true)
    String resultJson

) {
}
