package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests de {@link DefaultScorePolicy} — barème unique aplati (issue #188).
 * <p>
 * Consolide les assertions historiques des tests V2→V6 : barème complet (V2),
 * {@code tech.security.version_disclosure} (ex-V4), {@code lighthouse.audit.*} poids nul
 * (ex-V5) et {@code runtime.*} en catégorie runtime seule (ex-V6). {@code version()} doit
 * rester 6 pour la continuité des {@code scoringVersion} persistés.
 */
class DefaultScorePolicyTest {

    private final DefaultScorePolicy policy = new DefaultScorePolicy();

    @Test
    void versionShouldAdvanceForDomainWeightedGlobal() {
        assertEquals(10, policy.version());
    }

    // ------------------------------------------------------------------ Lighthouse

    /** Poids perf relevé 15 -> 22 (issue #199). */
    @Test
    void lighthousePerformanceShouldBeScorableWithWeight22() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.score.performance");
        assertTrue(rule.scorable());
        assertEquals(22.0, rule.weight());
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
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.some.new.metric");
        assertFalse(rule.scorable());
        assertEquals(0.0, rule.weight());
    }

    /** Ex-V5 : audits Lighthouse individuels scorables mais de poids nul (surfacés sans double comptage). */
    @Test
    void lighthouseIndividualAuditsAreScorableButZeroWeight() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("lighthouse", "lighthouse.audit.uses-responsive-images");
        assertTrue(rule.scorable());
        assertEquals(0.0, rule.weight());
        assertTrue(rule.tags().contains("lighthouse"));
    }

    // ------------------------------------------------------------------ Runtime (domaine performance, #197)

    @Test
    void runtimeConsoleErrorsIsInPerformanceDomain() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.console.errors");
        assertTrue(rule.scorable());
        assertEquals(5.0, rule.weight());
        // Domaine métier Performance (#197) + provenance runtime conservée.
        assertTrue(rule.tags().contains("performance"));
        assertTrue(rule.tags().contains("runtime"));
    }

    @Test
    void runtimeJsErrorsUsesEmittedKey() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.js.errors");
        assertTrue(rule.scorable());
        assertEquals(6.0, rule.weight());
        assertTrue(rule.tags().contains("performance"));
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
    void thirdPartyRuntimeErrorsRemainVisibleButHaveZeroWeight() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.network.third_party_errors");
        assertTrue(rule.scorable());
        assertEquals(0.0, rule.weight());
        assertTrue(rule.tags().contains("performance"));
    }

    @Test
    void unknownRuntimeKeyFallsBackToPerformanceDomain() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.some.new.check");
        assertTrue(rule.scorable());
        assertEquals(4.0, rule.weight());
        assertTrue(rule.tags().contains("performance"));
        assertTrue(rule.tags().contains("runtime"));
    }

    // ------------------------------------------------------------------ SSL / Observatory

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
        ScorePolicy.ScoreRule rule = policy.ruleFor("zap", "zap.alert.10038");
        assertFalse(rule.scorable());
        assertEquals(0.0, rule.weight());
    }

    @Test
    void lighthouseNativeCategoriesShouldMapToDisplayedBusinessDomains() {
        assertEquals("a11y", policy.businessCategoryFor(
            "lighthouse", "lighthouse.audit.color-contrast", List.of("lighthouse", "accessibility")).orElseThrow());
        assertEquals("security", policy.businessCategoryFor(
            "lighthouse", "lighthouse.audit.no-vulnerable-libraries", List.of("lighthouse", "best-practices")).orElseThrow());
    }

    // ------------------------------------------------------------------ HTTP / HTML / Tech

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

    @Test
    void robotsTxtShouldBeScoredUnderSeo() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("http", "http.seo.robots_txt");
        assertTrue(rule.scorable());
        assertEquals(2.0, rule.weight());
        assertTrue(rule.tags().contains("seo"));
    }

    @Test
    void sitemapShouldBeScoredUnderSeo() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("http", "http.seo.sitemap");
        assertTrue(rule.scorable());
        assertEquals(3.0, rule.weight());
        assertTrue(rule.tags().contains("seo"));
    }

    @Test
    void structuralHttpFallbackShouldRemainVisibleUnderPerformance() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("http", "http.future.structure_check");
        assertTrue(rule.scorable());
        assertTrue(rule.tags().contains("performance"));
        assertEquals("performance", policy.businessCategoryFor("http", "http.future.structure_check", List.of()).orElseThrow());
    }

    /** Ex-V4 : divulgation de version logicielle scorable sous security (issue #158). */
    @Test
    void versionDisclosureIsScorableSecurity() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("tech", "tech.security.version_disclosure");
        assertTrue(rule.scorable());
        assertEquals(3.0, rule.weight());
        assertTrue(rule.tags().contains("security"));
        assertTrue(rule.tags().contains("tech"));
    }

    // ------------------------------------------------------------------ Availability / unknown

    @Test
    void availabilityStubsAreNeverScored() {
        for (String key : new String[]{
            "ssl.available", "runtime.collect", "html.available",
            "observatory.available", "zap.available", "lighthouse.collect"
        }) {
            ScorePolicy.ScoreRule rule = policy.ruleFor("any", key);
            assertFalse(rule.scorable(), key + " should not be scorable");
            assertEquals(0.0, rule.weight(), key + " should have weight 0");
        }
    }

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
