package com.dokor.argos.services.analysis.scoring;

import java.util.List;
import java.util.Map;

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
    List<ScoreAggregate> byDomain,    // id=business domain, normalized independently
    Map<String, Double> domainWeights, // effective weights after unavailable-domain renormalization

    List<ScoredCheck> checks          // traçabilité check par check
) {
    /** Compatibilité source pour les producteurs/lecteurs qui ne portent pas encore les domaines. */
    public AuditScoreReport(
        int scoringVersion,
        ScoreAggregate global,
        List<ScoreAggregate> byModule,
        List<ScoreAggregate> byTag,
        List<ScoredCheck> checks
    ) {
        this(scoringVersion, global, byModule, byTag, List.of(), Map.of(), checks);
    }
}

