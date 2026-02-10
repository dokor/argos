package com.dokor.argos.services.analysis.scoring;

import java.util.List;

/**
 * Score calculé à partir des checks enrichis (weight/scorable/tags).
 * <p>
 * scoringVersion : version des règles/poids (indépendante du schema du report).
 */
public record AuditScoreReport(
    int scoringVersion,

    ScoreAggregate global,
    List<ScoreAggregate> byModule,    // id=moduleId
    List<ScoreAggregate> byTag,       // id=tag

    List<ScoredCheck> checks          // traçabilité check par check
) {
}

