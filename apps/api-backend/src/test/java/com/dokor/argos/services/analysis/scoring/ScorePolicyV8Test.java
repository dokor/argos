package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ScorePolicyV8} : la performance Lighthouse pèse davantage (issue #199).
 */
class ScorePolicyV8Test {

    private final ScorePolicyV8 policy = new ScorePolicyV8();

    @Test
    void versionShouldBe8() {
        assertEquals(8, policy.version());
    }

    @Test
    void lighthousePerformanceWeightIsRaised() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.performance");
        assertEquals(22.0, rule.weight(), "poids relevé 15 -> 22 (#199)");
        assertTrue(rule.scorable());
        assertTrue(rule.tags().contains("performance"), "reste dans le domaine performance");
    }

    @Test
    void otherLighthouseWeightsUnchanged() {
        assertEquals(10.0, policy.ruleFor("lighthouse", "lighthouse.score.accessibility").weight());
        assertEquals(8.0, policy.ruleFor("lighthouse", "lighthouse.score.seo").weight());
        assertEquals(6.0, policy.ruleFor("lighthouse", "lighthouse.score.best-practices").weight());
    }

    @Test
    void inheritsV7DomainForRuntime() {
        assertTrue(policy.ruleFor("runtime", "runtime.console.errors").tags().contains("performance"));
    }
}
