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
    String scoringFingerprint,

    ScoreAggregate global,
    List<ScoreAggregate> byModule,    // id=moduleId
    List<ScoreAggregate> byTag,       // id=tag
    List<ScoreAggregate> byDomain,    // id=business domain, normalized independently
    Map<String, Double> domainWeights, // effective weights after unavailable-domain renormalization

    List<ScoredCheck> checks,          // traçabilité check par check
    MeasurementCoverage coverage,
    Map<String,Double> configuredDomainWeights
) {
    public AuditScoreReport(int version, String fingerprint, ScoreAggregate global,
        List<ScoreAggregate> modules, List<ScoreAggregate> tags, List<ScoreAggregate> domains,
        Map<String,Double> weights, List<ScoredCheck> checks, MeasurementCoverage coverage) {
        this(version,fingerprint,global,modules,tags,domains,weights,checks,coverage,null);
    }
    public AuditScoreReport(int version, String fingerprint, ScoreAggregate global,
        List<ScoreAggregate> modules, List<ScoreAggregate> tags, List<ScoreAggregate> domains,
        Map<String,Double> weights, List<ScoredCheck> checks) {
        this(version,fingerprint,global,modules,tags,domains,weights,checks,null);
    }
    /** Compatibilité source pour les consommateurs qui ne portent ni empreinte ni domaines. */
    public AuditScoreReport(
        int scoringVersion,
        ScoreAggregate global,
        List<ScoreAggregate> byModule,
        List<ScoreAggregate> byTag,
        List<ScoreAggregate> byDomain,
        Map<String, Double> domainWeights,
        List<ScoredCheck> checks
    ) {
        this(scoringVersion, null, global, byModule, byTag, byDomain, domainWeights, checks);
    }

    /** Compatibilité source pour les consommateurs qui ne portent ni empreinte ni domaines. */
    public AuditScoreReport(
        int scoringVersion,
        ScoreAggregate global,
        List<ScoreAggregate> byModule,
        List<ScoreAggregate> byTag,
        List<ScoredCheck> checks
    ) {
        this(scoringVersion, null, global, byModule, byTag, List.of(), Map.of(), checks);
    }
}

