package com.dokor.argos.services.analysis.model;

import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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
 * sources : modules qui ont contribué à ce check (rempli par CheckMergerService / annotateWithSource).
 */
public record AuditCheckResult(
    String key,
    String title,

    AuditStatus status,
    AuditSeverity severity,

    boolean scorable,     // INFO => false
    double weight,        // 0 si non scorable
    List<String> tags,

    Object value,
    Map<String, Object> details,

    String message,
    String recommendation,
    List<String> sources
) {
    public AuditCheckResult {
        sources = sources != null ? List.copyOf(sources) : List.of();
        tags = tags != null ? tags : List.of();
    }

    /** Factory pour les modules existants (sources vide, rempli par CheckMergerService) */
    public static AuditCheckResult of(
        String key, String title,
        AuditStatus status, AuditSeverity severity,
        boolean scorable, double weight, List<String> tags,
        Object value, Map<String, Object> details,
        String message, String recommendation
    ) {
        return new AuditCheckResult(key, title, status, severity, scorable, weight, tags,
            value, details, message, recommendation, List.of());
    }

    public AuditCheckResult withSources(List<String> newSources) {
        return new AuditCheckResult(key, title, status, severity, scorable, weight, tags,
            value, details, message, recommendation, newSources);
    }

    public AuditCheckResult mergeWith(AuditCheckResult other) {
        AuditStatus mergedStatus = statusRank(other.status) > statusRank(this.status) ? other.status : this.status;
        AuditSeverity mergedSeverity = severityRank(other.severity) > severityRank(this.severity) ? other.severity : this.severity;
        Map<String, Object> mergedDetails = new LinkedHashMap<>(this.details);
        other.details.forEach(mergedDetails::putIfAbsent);
        List<String> mergedSources = new ArrayList<>(this.sources);
        other.sources.forEach(s -> { if (!mergedSources.contains(s)) mergedSources.add(s); });
        String mergedMessage = statusRank(other.status) > statusRank(this.status) ? other.message : this.message;
        String mergedReco = this.recommendation != null ? this.recommendation : other.recommendation;
        return new AuditCheckResult(key, title, mergedStatus, mergedSeverity,
            this.scorable || other.scorable, Math.max(this.weight, other.weight),
            this.tags, this.value, mergedDetails, mergedMessage, mergedReco, List.copyOf(mergedSources));
    }

    private static int statusRank(AuditStatus s) {
        return switch (s) { case INFO -> 0; case PASS -> 1; case WARN -> 2; case FAIL -> 3; };
    }

    private static int severityRank(AuditSeverity s) {
        return switch (s) { case LOW -> 0; case MEDIUM -> 1; case HIGH -> 2; };
    }
}
