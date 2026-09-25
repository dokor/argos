package com.dokor.argos.services.analysis.scoring;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Contrat entre les analyseurs et le catalogue de score. Ajouter une clé émise
 * demande de l'ajouter ici et de décider explicitement son applicabilité.
 */
class ScorePolicyContractTest {

    private final DefaultScorePolicy policy = new DefaultScorePolicy();

    @Test
    void everyStaticKeyEmittedByAnalyzersIsCatalogued() {
        List<Set<String>> keysByModule = List.of(
            Set.of(
                "http.antibot.challenge", "http.protocol.version", "http.errors", "http.status_code",
                "http.redirect.count", "http.final_url.https", "http.redirect.to_https", "http.response_time_ms",
                "http.headers.content_type", "http.security.hsts", "http.security.csp",
                "http.security.x_content_type_options", "http.security.x_frame_options", "http.security.referrer_policy",
                "http.security.permissions_policy", "http.security.cookie_flags", "http.protocol.http2",
                "http.headers.compression", "http.headers.caching", "http.headers.server", "http.seo.robots_txt",
                "http.seo.sitemap"
            ),
            Set.of(
                "html.meta.robots.present", "html.scripts.count", "html.size.bytes", "html.analysis.duration_ms",
                "html.title", "html.meta.description.present", "html.link.canonical.present", "html.h1.count",
                "html.lang", "html.meta.viewport.present", "html.doctype.html5", "html.meta.charset.present",
                "html.social.meta", "html.images.alt_coverage", "html.anchors.href_coverage", "html.available"
            ),
            Set.of(
                "runtime.collect", "runtime.console.errors", "runtime.js.errors", "runtime.network.5xx",
                "runtime.network.failed_requests", "runtime.network.third_party_errors", "runtime.network.request_count",
                "runtime.network.bytes_estimated", "runtime.analysis.duration_ms"
            ),
            Set.of(
                "lighthouse.collect", "lighthouse.score.performance", "lighthouse.score.accessibility",
                "lighthouse.score.best-practices", "lighthouse.score.seo"
            ),
            Set.of(
                "ssl.grade", "ssl.certificate.valid", "ssl.certificate.expiry_days", "ssl.protocols.tls13",
                "ssl.protocols.tls12", "ssl.protocols.legacy_disabled", "ssl.available"
            ),
            Set.of("observatory.score", "observatory.grade", "observatory.tests.passed", "observatory.available"),
            Set.of("zap.scan.result", "zap.available"),
            Set.of(
                "tech.cms", "tech.frontend.framework", "tech.frontend.nextjs", "tech.backend.hints",
                "tech.cdn.cloudflare", "tech.http.server_header", "tech.security.version_disclosure",
                "tech.html.available", "tech.analysis.duration_ms"
            )
        );

        for (Set<String> moduleKeys : keysByModule) {
            assertTrue(policy.cataloguedKeys().containsAll(moduleKeys),
                () -> "Missing catalogue entries: " + moduleKeys.stream()
                    .filter(key -> !policy.cataloguedKeys().contains(key)).toList());
        }
    }

    @Test
    void onlyDocumentedDynamicPatternsCanBypassExactCatalogue() {
        ScorePolicy.ScoreRule lighthouseAudit = policy.ruleFor("lighthouse", "lighthouse.audit.uses-responsive-images");
        ScorePolicy.ScoreRule zapAlert = policy.ruleFor("zap", "zap.alert.99999");
        ScorePolicy.ScoreRule unknownHttp = policy.ruleFor("http", "http.future.unreviewed");

        assertEquals(ScoreApplicability.VISIBLE_DIAGNOSTIC, lighthouseAudit.applicability());
        assertEquals(0.0, lighthouseAudit.weight());
        assertEquals(ScoreApplicability.INFORMATIONAL, zapAlert.applicability());
        assertEquals(ScoreApplicability.INFORMATIONAL, unknownHttp.applicability());
    }

    @Test
    void scoreRulesKeepBusinessCategoryAndTechnicalSourceTyped() {
        ScorePolicy.ScoreRule rule = policy.ruleFor("runtime", "runtime.network.5xx");

        assertEquals(BusinessCategory.PERFORMANCE, rule.businessCategory());
        assertEquals(TechnicalSource.RUNTIME, rule.technicalSource());
        assertEquals(ScoreApplicability.SCORE, rule.applicability());
    }

    @Test
    void invalidRuleWeightsAreRejectedAtCatalogueConstruction() {
        assertThrows(IllegalArgumentException.class, () -> new ScorePolicy.ScoreRule(
            ScoreApplicability.SCORE, Double.NaN, BusinessCategory.PERFORMANCE, TechnicalSource.HTTP));
        assertThrows(IllegalArgumentException.class, () -> new ScorePolicy.ScoreRule(
            ScoreApplicability.SCORE, 0.0, BusinessCategory.PERFORMANCE, TechnicalSource.HTTP));
    }
}
