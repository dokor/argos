package com.dokor.argos.services.analysis.model;

public record ScoreAggregate(
    String id,            // "global" ou moduleId ou tag
    double score,         // somme scores
    double maxScore,      // somme poids
    double ratio          // score/maxScore (0..1), 0 si maxScore=0
) {}
