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
    @Schema(example = "https://example.com") String inputUrl,
    @Schema(example = "https://example.com/") String normalizedUrl,

    @Schema(example = "42")
    @JsonSerialize(using = ToStringSerializer.class)
    long runId,
    @Schema(example = "QUEUED") String status,

    Instant createdAt,
    Instant finishedAt,

    /**
     * JSON complet du report si dispo.
     * (MVP) On le renvoie brut (String) pour affichage/debug.
     */
    String resultJson
) {
}
