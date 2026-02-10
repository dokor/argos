package com.dokor.argos.services.analysis.model;

import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;

import java.util.List;
import java.util.Map;

/**
 * Un check = une unité atomique exploitable pour :
 * - afficher (PDF/Front)
 * - scorer (pondération par key + status + severity)
 * <p>
 * Règles importantes :
 * - key doit être STABLE dans le temps (ne pas la renommer après publication)
 * Exemple : "http.status_code", "html.title.present"
 * - status est standardisé (PASS/WARN/FAIL/INFO)
 * - severity permet de pondérer (LOW/MEDIUM/HIGH)
 * <p>
 * value + evidence doivent rester simples (JSON sérialisable).
 */
public record AuditCheckResult(
    String key,
    String label,
    AuditStatus status,
    AuditSeverity severity,
    boolean scorable,     // INFO => false
    double weight,        // 0 si non scorable
    Object value,
    Map<String, Object> evidence,
    String message,
    String recommendation,
    List<String> tags
) {
}
