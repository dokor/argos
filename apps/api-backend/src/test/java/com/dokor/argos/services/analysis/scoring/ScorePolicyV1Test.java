package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ScorePolicyV1Test {

    private final ScorePolicyV1 policy = new ScorePolicyV1();

    // ------------------------------------------------------------------ exact overrides

    @Test
    void lighthousePerformanceShouldBeScorableWithWeight15() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.performance");
        assertTrue(rule.scorable());
        assertEquals(15.0, rule.weight());
        assertTrue(rule.tags().contains("performance"));
        assertTrue(rule.tags().contains("lighthouse"));
    }

    @Test
    void lighthouseAccessibilityShouldBeScorableAndTaggedA11y() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.accessibility");
        assertTrue(rule.scorable());
        assertEquals(10.0, rule.weight());
        assertTrue(rule.tags().contains("a11y"));
    }

    @Test
    void lighthouseBestPracticesShouldBeTaggedSecurity() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.best_practices");
        assertTrue(rule.scorable());
        assertEquals(6.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
    }

    @Test
    void lighthouseSeoRuleShouldExist() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.seo");
        assertTrue(rule.scorable());
        assertEquals(8.0, rule.weight());
        assertTrue(rule.tags().contains("seo"));
    }

    @Test
    void runtimeConsoleErrorsShouldBeScorable() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.console_errors");
        assertTrue(rule.scorable());
        assertEquals(5.0, rule.weight());
        assertTrue(rule.tags().contains("performance"));
    }

    @Test
    void runtimeJsErrorsShouldBeScorable() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.js_errors");
        assertTrue(rule.scorable());
        assertEquals(6.0, rule.weight());
    }

    @Test
    void runtimeHttp5xxShouldCarryHighestRuntimeWeight() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.http5xx_on_load");
        assertTrue(rule.scorable());
        assertEquals(8.0, rule.weight());
    }

    @Test
    void httpHstsShouldBeScorableWithWeight8() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("http", "http.security.hsts");
        assertTrue(rule.scorable());
        assertEquals(8.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
    }

    @Test
    void htmlTitleShouldBeScorableAndTaggedSeo() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("html", "html.title");
        assertTrue(rule.scorable());
        assertTrue(rule.tags().contains("seo"));
    }

    @Test
    void techKeysShouldNotBeScored() {
        ScorePolicy.ScoreRule cms  = policy.ruleFor("tech", "tech.cms");
        ScorePolicy.ScoreRule ff   = policy.ruleFor("tech", "tech.frontend.framework");
        assertFalse(cms.scorable());
        assertFalse(ff.scorable());
        assertEquals(0.0, cms.weight());
    }

    // ------------------------------------------------------------------ prefix fallbacks

    @Test
    void unknownLighthouseKeyShouldFallBackToPerformance() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.some.new.metric");
        assertTrue(rule.scorable());
        assertTrue(rule.tags().contains("performance"));
    }

    @Test
    void unknownRuntimeKeyShouldFallBackToPerformance() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.some.new.check");
        assertTrue(rule.scorable());
        assertTrue(rule.tags().contains("performance"));
    }

    @Test
    void unknownHttpSecurityKeyShouldFallBackToSecurityTag() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("http", "http.security.new_header");
        assertTrue(rule.scorable());
        assertTrue(rule.tags().contains("security"));
    }

    @Test
    void completelyUnknownKeyShouldNotBeScored() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("unknown", "unknown.check.xyz");
        assertFalse(rule.scorable());
        assertEquals(0.0, rule.weight());
    }
}
