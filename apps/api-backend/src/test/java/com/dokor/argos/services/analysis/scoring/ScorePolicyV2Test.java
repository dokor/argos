package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ScorePolicyV2Test {

    private final ScorePolicyV2 policy = new ScorePolicyV2();

    @Test
    void versionShouldBe2() {
        assertEquals(2, policy.version());
    }

    // ------------------------------------------------------------------ Lighthouse

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
    void lighthouseBestPracticesUsesHyphenKeyAndIsTaggedSecurity() {
        // La clé émise par l'analyzer est l'id de catégorie Lighthouse "best-practices" (avec tiret).
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.best-practices");
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
    void unknownLighthouseKeyShouldBeInformationalOnly() {
        // Fiabilité : un check lighthouse inconnu ne doit pas être scoré automatiquement.
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.some.new.metric");
        assertFalse(rule.scorable());
        assertEquals(0.0, rule.weight());
    }

    // ------------------------------------------------------------------ Runtime (fix A)

    @Test
    void runtimeConsoleErrorsUsesEmittedKeyAndScoresPerformance() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.console.errors");
        assertTrue(rule.scorable());
        assertEquals(5.0, rule.weight());
        assertTrue(rule.tags().contains("performance"));
    }

    @Test
    void runtimeJsErrorsUsesEmittedKey() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.js.errors");
        assertTrue(rule.scorable());
        assertEquals(6.0, rule.weight());
    }

    @Test
    void runtime5xxCarriesHighestRuntimeWeight() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.network.5xx");
        assertTrue(rule.scorable());
        assertEquals(8.0, rule.weight());
    }

    @Test
    void runtimeFailedRequestsUsesEmittedKey() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.network.failed_requests");
        assertTrue(rule.scorable());
        assertEquals(4.0, rule.weight());
    }

    @Test
    void unknownRuntimeKeyFallsBackToPerformance() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.some.new.check");
        assertTrue(rule.scorable());
        assertEquals(4.0, rule.weight());
        assertTrue(rule.tags().contains("performance"));
    }

    // ------------------------------------------------------------------ SSL / Observatory (fix B)

    @Test
    void sslGradeShouldBeScoredUnderSecurity() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("ssl", "ssl.grade");
        assertTrue(rule.scorable());
        assertEquals(10.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
    }

    @Test
    void sslCertificateValidShouldBeScored() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("ssl", "ssl.certificate.valid");
        assertTrue(rule.scorable());
        assertEquals(6.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
    }

    @Test
    void unknownSslKeyFallsBackToSecurity() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("ssl", "ssl.protocols.new_thing");
        assertTrue(rule.scorable());
        assertEquals(3.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
    }

    @Test
    void observatoryScoreShouldBeScoredUnderSecurity() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("observatory", "observatory.score");
        assertTrue(rule.scorable());
        assertEquals(8.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
    }

    // ------------------------------------------------------------------ ZAP informatif

    @Test
    void genericZapAlertsAreInformationalOnly() {
        // Les alertes ZAP génériques ne sont pas scorées (les findings d'en-têtes
        // remontent via http.security.*), pour éviter l'inflation par nombre d'alertes.
        ScorePolicy.ScoreRule rule = policy.ruleFor("zap", "zap.alert.10038");
        assertFalse(rule.scorable());
        assertEquals(0.0, rule.weight());
    }

    // ------------------------------------------------------------------ HTTP / HTML

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
    void unknownHttpSecurityKeyFallsBackToSecurity() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("http", "http.security.new_header");
        assertTrue(rule.scorable());
        assertTrue(rule.tags().contains("security"));
    }

    // ------------------------------------------------------------------ Availability / degraded stubs

    @Test
    void availabilityStubsAreNeverScored() {
        // Statut WARN mais ne doivent jamais peser sur le score (panne service externe).
        for (String key : new String[]{
            "ssl.available", "runtime.collect", "html.available",
            "observatory.available", "zap.available", "lighthouse.collect"
        }) {
            ScorePolicy.ScoreRule rule = policy.ruleFor("any", key);
            assertFalse(rule.scorable(), key + " should not be scorable");
            assertEquals(0.0, rule.weight(), key + " should have weight 0");
        }
    }

    // ------------------------------------------------------------------ Tech / unknown

    @Test
    void techKeysShouldNotBeScored() {
        ScorePolicy.ScoreRule cms = policy.ruleFor("tech", "tech.cms");
        assertFalse(cms.scorable());
        assertEquals(0.0, cms.weight());
    }

    @Test
    void completelyUnknownKeyShouldNotBeScored() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("unknown", "unknown.check.xyz");
        assertFalse(rule.scorable());
        assertEquals(0.0, rule.weight());
    }
}
