package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ScorePolicyV6} : les checks {@code runtime.*} ne portent plus le
 * tag {@code performance} (issue #172), tout en conservant poids et scorable. Le
 * reste du barème (Lighthouse, V4/V5) est hérité inchangé.
 */
class ScorePolicyV6Test {

    private final ScorePolicyV6 policy = new ScorePolicyV6();

    @Test
    void versionShouldBe6() {
        assertEquals(6, policy.version());
    }

    @Test
    void runtimeExplicitCheckIsRuntimeOnlyNotPerformance() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.console.errors");
        assertTrue(rule.tags().contains("runtime"), "doit rester taggé runtime");
        assertFalse(rule.tags().contains("performance"), "ne doit plus être taggé performance (#172)");
        // Poids et scorable inchangés vs le barème V2.
        assertTrue(rule.scorable());
        assertEquals(5.0, rule.weight());
    }

    @Test
    void runtimePrefixFallbackIsRuntimeOnly() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.some.unknown.key");
        assertTrue(rule.tags().contains("runtime"));
        assertFalse(rule.tags().contains("performance"));
        assertEquals(4.0, rule.weight());
    }

    @Test
    void performanceCategoryStillFedByLighthouse() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.performance");
        assertTrue(rule.tags().contains("performance"), "Lighthouse reste dans la catégorie Performance");
        assertEquals(15.0, rule.weight());
    }

    @Test
    void inheritsV5AndV4Rules() {
        // Règle V5 : audits Lighthouse individuels scorables mais poids nul.
        ScorePolicy.ScoreRule lh = policy.ruleFor("lighthouse", "lighthouse.audit.uses-responsive-images");
        assertTrue(lh.scorable());
        assertEquals(0.0, lh.weight());
        // Règle V4 conservée.
        assertTrue(policy.ruleFor("tech", "tech.security.version_disclosure").scorable());
    }
}
