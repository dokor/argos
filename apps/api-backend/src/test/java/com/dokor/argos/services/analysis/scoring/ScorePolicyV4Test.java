package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ScorePolicyV4} : version bumpée + règle du nouveau check
 * scorable {@code tech.security.version_disclosure} (issue #158), le reste du
 * barème étant hérité de V3/V2.
 */
class ScorePolicyV4Test {

    private final ScorePolicyV4 policy = new ScorePolicyV4();

    @Test
    void versionShouldBe4() {
        assertEquals(4, policy.version());
    }

    @Test
    void versionDisclosureIsScorableSecurity() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("tech", "tech.security.version_disclosure");
        assertTrue(rule.scorable());
        assertEquals(3.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
    }

    @Test
    void inheritsV3Barème() {
        // Spot-check : le barème hérité est intact.
        ScorePolicy.ScoreRule perf = policy.ruleFor("lighthouse", "lighthouse.score.performance");
        assertEquals(15.0, perf.weight());
        // tech.* non listé reste non scoré (fallback).
        assertTrue(!policy.ruleFor("tech", "tech.cms").scorable());
    }
}
