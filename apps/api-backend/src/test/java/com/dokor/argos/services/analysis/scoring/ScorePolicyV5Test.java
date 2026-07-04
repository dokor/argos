package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ScorePolicyV5} : version bumpée + règle des audits Lighthouse
 * individuels {@code lighthouse.audit.*} (issue #154), scorables mais de poids
 * nul (surfacés comme issues sans double comptage). Le reste du barème est
 * hérité de V4/V3/V2.
 */
class ScorePolicyV5Test {

    private final ScorePolicyV5 policy = new ScorePolicyV5();

    @Test
    void versionShouldBe5() {
        assertEquals(5, policy.version());
    }

    @Test
    void lighthouseAuditIsScorableButZeroWeight() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.audit.uses-responsive-images");
        assertTrue(rule.scorable(), "doit être scorable pour apparaître comme issue");
        assertEquals(0.0, rule.weight(), "poids nul : n'entre pas dans le score (pas de double comptage)");
    }

    @Test
    void inheritsV4Rules() {
        // Règle V4 conservée.
        assertTrue(policy.ruleFor("tech", "tech.security.version_disclosure").scorable());
        // Barème V2 : les notes de catégorie Lighthouse gardent leur poids.
        assertEquals(15.0, policy.ruleFor("lighthouse", "lighthouse.score.performance").weight());
    }
}
