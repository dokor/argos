package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;

/**
 * Politique de scoring v8 — la performance Lighthouse pèse davantage (issue #199).
 * <p>
 * Hérite du barème de {@link ScorePolicyV7} et relève le poids de
 * {@code lighthouse.score.performance} de 15 à {@value #PERFORMANCE_WEIGHT} pour
 * donner plus d'impact à la performance dans le score global. Tags et caractère
 * scorable inchangés ; les autres règles sont héritées telles quelles.
 */
@Singleton
public class ScorePolicyV8 extends ScorePolicyV7 {

    private static final int VERSION = 8;
    private static final double PERFORMANCE_WEIGHT = 22;

    @Override
    public int version() {
        return VERSION;
    }

    @Override
    public ScoreRule ruleFor(String moduleId, String checkKey) {
        ScoreRule rule = super.ruleFor(moduleId, checkKey);
        if ("lighthouse.score.performance".equals(checkKey)) {
            return new ScoreRule(rule.scorable(), PERFORMANCE_WEIGHT, rule.tags());
        }
        return rule;
    }
}
