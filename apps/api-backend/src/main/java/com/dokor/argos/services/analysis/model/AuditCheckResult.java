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
 * - scorer (poids déterminé par la key via {@code ScorePolicy}, pondéré par le status)
 * <p>
 * Règles importantes :
 * - key doit être STABLE dans le temps (ne pas la renommer après publication)
 * Exemple : "http.status_code", "html.title.present"
 * - status est standardisé (PASS/WARN/FAIL/INFO) et pilote le ratio de score
 *   (PASS=1, WARN=0.5, FAIL/INFO=0)
 * - severity (LOW/MEDIUM/HIGH) sert à l'AFFICHAGE et à la PRIORISATION des issues,
 *   PAS au calcul du poids (celui-ci vient exclusivement de la key via ScorePolicy)
 * <p>
 * value + evidence doivent rester simples (JSON sérialisable).
 * sources : modules qui ont contribué à ce check (rempli par CheckMergerService / annotateWithSource).
 * <p>
 * scoreRatio : ratio de score continu dans [0,1] qui, lorsqu'il est renseigné,
 * <b>remplace</b> le ratio dérivé du status (PASS=1 / WARN=0.5 / FAIL=0) dans
 * {@code ScoreService}. Il permet aux checks fondés sur une note graduée (ex. scores
 * Lighthouse 0..100) d'éviter les effets de falaise aux bornes des seuils PASS/WARN/FAIL.
 * {@code null} ⇒ on retombe sur le ratio dérivé du status (cas général).
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
    List<String> sources,
    Double scoreRatio     // null => ratio dérivé du status ; sinon ratio continu [0,1]
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
            value, details, message, recommendation, List.of(), null);
    }

    public AuditCheckResult withSources(List<String> newSources) {
        return new AuditCheckResult(key, title, status, severity, scorable, weight, tags,
            value, details, message, recommendation, newSources, scoreRatio);
    }

    /**
     * Attache un ratio de score continu dans [0,1] (voir {@link #scoreRatio()}).
     * Utilisé par les checks à note graduée (ex. Lighthouse) pour éviter les
     * effets de falaise aux bornes des seuils de status.
     */
    public AuditCheckResult withScoreRatio(Double ratio) {
        return new AuditCheckResult(key, title, status, severity, scorable, weight, tags,
            value, details, message, recommendation, sources, ratio);
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
        Double mergedScoreRatio = this.scoreRatio != null ? this.scoreRatio : other.scoreRatio;
        return new AuditCheckResult(key, title, mergedStatus, mergedSeverity,
            this.scorable || other.scorable, Math.max(this.weight, other.weight),
            this.tags, this.value, mergedDetails, mergedMessage, mergedReco, List.copyOf(mergedSources),
            mergedScoreRatio);
    }

    private static int statusRank(AuditStatus s) {
        return switch (s) { case INFO -> 0; case PASS -> 1; case WARN -> 2; case FAIL -> 3; };
    }

    private static int severityRank(AuditSeverity s) {
        return switch (s) { case LOW -> 0; case MEDIUM -> 1; case HIGH -> 2; };
    }
}
