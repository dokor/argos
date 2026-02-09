package com.dokor.argos.webservices.api.audits.data;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Response returned after creating an audit run")
public record CreateAuditResponse(

    @Schema(description = "Identifier of the created audit run", example = "42")
    Long idRun,

    @Schema(description = "Identifier of the related audit", example = "12")
    Long idAudit,

    @Schema(description = "Initial status of the audit run", example = "QUEUED")
    String status,

    @Schema(description = "Creation timestamp of the audit run")
    Instant createdAt
) {
}
