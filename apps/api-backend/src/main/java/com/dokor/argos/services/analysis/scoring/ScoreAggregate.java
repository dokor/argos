package com.dokor.argos.services.analysis.scoring;

/**
 * Agrégat de score (global / par module / par tag).
 */
public record ScoreAggregate(
    String id,            // "global" ou moduleId ou tag
    double score,         // somme scores
    double maxScore,      // somme poids
    double ratio          // score/maxScore (0..1), 0 si maxScore=0
) {
    public static ScoreAggregate of(String id, double score, double maxScore) {
        double ratio = (maxScore <= 0.0) ? 0.0 : (score / maxScore);
        return new ScoreAggregate(id, score, maxScore, ratio);
    }
}
