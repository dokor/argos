package com.dokor.argos.webservices.api.audits.data;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * Un élément de l'historique des analyses d'un audit (une URL).
 * <p>
 * Chaque item correspond à un {@code AuditRun} passé, du plus récent au plus ancien,
 * avec le lien vers son rapport et le score global lorsqu'il est disponible.
 */
@Schema(name = "AuditHistoryItemResponse")
public record AuditHistoryItemResponse(
    @JsonSerialize(using = ToStringSerializer.class)
    @Schema(example = "42")
    long runId,

    @Schema(example = "COMPLETED")
    String status,

    Instant createdAt,
    Instant finishedAt,

    @Schema(example = "aB3dEf…")
    String reportToken,
    @Schema(example = "/reports/aB3dEf…")
    String reportUrl,

    /** Score global 0..100 issu du rapport publié, ou {@code null} si indisponible. */
    @Schema(example = "68")
    Integer globalScore
) {
}
