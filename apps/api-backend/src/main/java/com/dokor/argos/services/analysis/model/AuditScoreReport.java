package com.dokor.argos.services.analysis.model;

import java.util.List;

public record AuditScoreReport(
    int scoringVersion,

    ScoreAggregate global,
    List<ScoreAggregate> byModule,    // id=moduleId
    List<ScoreAggregate> byTag,       // id=tag

    List<ScoredCheck> checks          // traçabilité check par check
) {}

