package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ScorePolicyV3} : le barème (poids/tags) est hérité de {@link ScorePolicyV2},
 * seule la version est bumpée pour matérialiser le changement de sémantique du score (issue #100).
 */
class ScorePolicyV3Test {

    private final ScorePolicyV3 policy = new ScorePolicyV3();

    @Test
    void versionShouldBe3() {
        assertEquals(3, policy.version());
    }

    @Test
    void inheritsWeightRulesFromV2() {
        // Spot-check : le barème V2 est conservé à l'identique.
        ScorePolicy.ScoreRule perf = policy.ruleFor("lighthouse", "lighthouse.score.performance");
        assertTrue(perf.scorable());
        assertEquals(15.0, perf.weight());
        assertTrue(perf.tags().contains("performance"));

        ScorePolicy.ScoreRule grade = policy.ruleFor("ssl", "ssl.grade");
        assertEquals(10.0, grade.weight());
        assertTrue(grade.tags().contains("security"));
    }
}
