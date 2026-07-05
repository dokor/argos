package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests de {@link ScorePolicyV7} : catégorisation par domaine (issue #197) — les
 * checks {@code runtime.*} sont de nouveau rattachés au domaine {@code performance}
 * (le tag « runtime » restant sert de provenance, plus de catégorie). Le reste du
 * barème est hérité de V6/V5/V4/V2.
 */
class ScorePolicyV7Test {

    private final ScorePolicyV7 policy = new ScorePolicyV7();

    @Test
    void versionShouldBe7() {
        assertEquals(7, policy.version());
    }

    @Test
    void runtimeIsBackInPerformanceDomain() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.console.errors");
        assertTrue(rule.tags().contains("performance"), "runtime relève du domaine Performance (#197)");
        // Poids inchangé vs barème V2.
        assertEquals(5.0, rule.weight());
        assertTrue(rule.scorable());
    }

    @Test
    void runtimePrefixFallbackIsInPerformanceDomain() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.some.unknown");
        assertTrue(rule.tags().contains("performance"));
        assertEquals(4.0, rule.weight());
    }

    @Test
    void inheritsDomainTagsFromBaseline() {
        // Les domaines des autres outils restent portés par leurs checks (provenance en +).
        assertTrue(policy.ruleFor("ssl", "ssl.grade").tags().contains("security"));
        assertTrue(policy.ruleFor("lighthouse", "lighthouse.score.performance").tags().contains("performance"));
        assertTrue(policy.ruleFor("lighthouse", "lighthouse.score.seo").tags().contains("seo"));
        // Règle V5 conservée (audits Lighthouse scorables, poids nul).
        assertEquals(0.0, policy.ruleFor("lighthouse", "lighthouse.audit.x").weight());
    }
}
