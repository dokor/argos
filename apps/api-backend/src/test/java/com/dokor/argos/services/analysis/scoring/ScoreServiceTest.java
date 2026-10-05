package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests unitaires de {@link ScoreService}.
 * <p>
 * On construit des {@link AuditModuleResult} avec des checks déjà enrichis
 * (scorable + weight fixés manuellement) pour isoler le calcul du score.
 */
class ScoreServiceTest {

    private final ScoreService service = new ScoreService();

    // -------------------------
    // Helpers
    // -------------------------

    private static AuditCheckResult check(String key, AuditStatus status, boolean scorable, double weight, String... tags) {
        List<String> effectiveTags = tags.length == 0 ? List.of("performance") : List.of(tags);
        return AuditCheckResult.of(
            key, key, status, AuditSeverity.LOW,
            scorable, weight, effectiveTags,
            null, Map.of(), "msg", null
        );
    }

    private static AuditModuleResult module(String id, AuditCheckResult... checks) {
        return new AuditModuleResult(id, id, "summary", Map.of(), List.of(checks));
    }

    // -------------------------
    // Calcul du score global
    // -------------------------

    @Test
    void globalScoreShouldBe100PercentWhenAllPass() {
        AuditCheckResult c1 = check("k1", AuditStatus.PASS, true, 10.0);
        AuditCheckResult c2 = check("k2", AuditStatus.PASS, true, 5.0);

        AuditScoreReport report = service.compute(1, List.of(module("http", c1, c2)));

        assertEquals(1.0, report.global().ratio(), 0.001);
        assertEquals(100.0, report.global().score(), 0.001);
        assertEquals(100.0, report.global().maxScore(), 0.001);
    }

    @Test
    void globalScoreShouldBe0WhenAllFail() {
        AuditCheckResult c = check("k1", AuditStatus.FAIL, true, 10.0);

        AuditScoreReport report = service.compute(1, List.of(module("http", c)));

        assertEquals(0.0, report.global().ratio(), 0.001);
        assertEquals(0.0, report.global().score(), 0.001);
    }

    @Test
    void warnShouldContribute50Percent() {
        AuditCheckResult c = check("k1", AuditStatus.WARN, true, 10.0);

        AuditScoreReport report = service.compute(1, List.of(module("http", c)));

        assertEquals(0.5, report.global().ratio(), 0.001);
        assertEquals(50.0, report.global().score(), 0.001);
        assertEquals(100.0, report.global().maxScore(), 0.001);
    }

    @Test
    void infoChecksShouldNotContributeToScore() {
        AuditCheckResult info = check("k.info", AuditStatus.INFO, false, 0.0);
        AuditCheckResult pass = check("k.pass", AuditStatus.PASS, true, 8.0);

        AuditScoreReport report = service.compute(1, List.of(module("http", info, pass)));

        assertEquals(100.0, report.global().score(), 0.001);
        assertEquals(100.0, report.global().maxScore(), 0.001);
    }

    @Test
    void nonScorableChecksAreIgnored() {
        AuditCheckResult nonScorable = check("k.tech", AuditStatus.PASS, false, 0.0);

        AuditScoreReport report = service.compute(1, List.of(module("tech", nonScorable)));

        assertEquals(0.0, report.global().score(), 0.001);
        assertEquals(0.0, report.global().maxScore(), 0.001);
    }

    // -------------------------
    // Ratio de score continu (scoreRatio) - anti-falaise Lighthouse (issue #100)
    // -------------------------

    @Test
    void continuousScoreRatioOverridesStatusRatio() {
        // status=FAIL donnerait ratio 0 ; le scoreRatio continu (0.59) doit primer.
        AuditCheckResult c = check("lighthouse.score.performance", AuditStatus.FAIL, true, 10.0)
            .withScoreRatio(0.59);

        AuditScoreReport report = service.compute(1, List.of(module("lighthouse", c)));

        assertEquals(59.0, report.global().score(), 0.001);
        assertEquals(100.0, report.global().maxScore(), 0.001);
    }

    @Test
    void continuousScoreRatioRemovesCliffAtThresholds() {
        // 59/100 (FAIL) et 60/100 (WARN) ne doivent plus produire un écart de score abrupt.
        AuditCheckResult at59 = check("lh59", AuditStatus.FAIL, true, 15.0).withScoreRatio(0.59);
        AuditCheckResult at60 = check("lh60", AuditStatus.WARN, true, 15.0).withScoreRatio(0.60);

        double score59 = service.compute(1, List.of(module("m", at59))).global().ratio();
        double score60 = service.compute(1, List.of(module("m", at60))).global().ratio();

        assertEquals(0.01, score60 - score59, 0.001);
    }

    @Test
    void continuousScoreRatioIsClampedToUnitInterval() {
        AuditCheckResult tooHigh = check("k.high", AuditStatus.PASS, true, 10.0).withScoreRatio(1.5);
        AuditCheckResult tooLow = check("k.low", AuditStatus.PASS, true, 10.0).withScoreRatio(-0.5);

        AuditScoreReport report = service.compute(1, List.of(module("m", tooHigh, tooLow)));

        assertEquals(50.0, report.global().score(), 0.001);
        assertEquals(100.0, report.global().maxScore(), 0.001);
    }

    @Test
    void nonFiniteRatiosAndWeightsCannotCorruptAggregates() {
        AuditCheckResult invalidRatio = check("ratio", AuditStatus.PASS, true, 10.0).withScoreRatio(Double.NaN);
        AuditCheckResult invalidWeight = check("weight", AuditStatus.PASS, true, Double.POSITIVE_INFINITY);
        AuditCheckResult negativeWeight = check("negative", AuditStatus.PASS, true, -4.0);

        AuditScoreReport report = service.compute(1, List.of(module("m", invalidRatio, invalidWeight, negativeWeight)));

        // Le seul check valide appartient au domaine mesurable Performance :
        // le global normalisé vaut donc 100/100, sans propagation de NaN/Inf.
        assertEquals(100.0, report.global().score(), 0.001);
        assertEquals(100.0, report.global().maxScore(), 0.001);
        assertTrue(Double.isFinite(report.global().ratio()));
    }

    // -------------------------
    // Agrégats par module
    // -------------------------

    @Test
    void shouldAggregateScorePerModule() {
        AuditCheckResult http = check("http.k", AuditStatus.PASS, true, 10.0);
        AuditCheckResult html = check("html.k", AuditStatus.WARN, true, 4.0);

        AuditScoreReport report = service.compute(1, List.of(
            module("http", http),
            module("html", html)
        ));

        ScoreAggregate httpAgg = report.byModule().stream().filter(a -> "http".equals(a.id())).findFirst().orElseThrow();
        ScoreAggregate htmlAgg = report.byModule().stream().filter(a -> "html".equals(a.id())).findFirst().orElseThrow();

        assertEquals(10.0, httpAgg.score(), 0.001);
        assertEquals(2.0, htmlAgg.score(), 0.001);   // 4 × 0.5
    }

    // -------------------------
    // Agrégats par tag
    // -------------------------

    @Test
    void shouldAggregateScoreByTag() {
        AuditCheckResult c1 = check("k1", AuditStatus.PASS, true, 8.0, "security");
        AuditCheckResult c2 = check("k2", AuditStatus.FAIL, true, 4.0, "security");

        AuditScoreReport report = service.compute(1, List.of(module("http", c1, c2)));

        ScoreAggregate secAgg = report.byTag().stream().filter(a -> "security".equals(a.id())).findFirst().orElseThrow();

        assertEquals(8.0, secAgg.score(), 0.001);    // c1 passe (8×1), c2 échoue (4×0)
        assertEquals(12.0, secAgg.maxScore(), 0.001);
    }

    @Test
    void duplicateTagsAreAggregatedOnlyOnce() {
        AuditCheckResult check = check("k", AuditStatus.PASS, true, 8.0, "security", "security");

        AuditScoreReport report = service.compute(1, List.of(module("http", check)));

        ScoreAggregate security = report.byTag().stream().filter(a -> "security".equals(a.id())).findFirst().orElseThrow();
        assertEquals(8.0, security.maxScore(), 0.001);
    }

    // -------------------------
    // scoringVersion transmis
    // -------------------------

    @Test
    void shouldForwardScoringVersion() {
        AuditScoreReport report = service.compute(42, "rubric-fingerprint", List.of(module("m")));
        assertEquals(42, report.scoringVersion());
        assertEquals("rubric-fingerprint", report.scoringFingerprint());
    }

    @Test
    void globalUsesEqualWeightsAcrossNormalizedDomains() {
        AuditCheckResult performanceCheck = check("perf", AuditStatus.PASS, true, 100.0, "performance");
        AuditCheckResult securityCheck = check("sec", AuditStatus.FAIL, true, 1.0, "security");

        AuditScoreReport report = service.compute(10, List.of(module("m", performanceCheck, securityCheck)));

        assertEquals(0.5, report.global().ratio(), 0.001);
        assertEquals(50.0, report.global().score(), 0.001);
        assertEquals(0.5, report.domainWeights().get("performance"), 0.001);
        assertEquals(0.5, report.domainWeights().get("security"), 0.001);
        ScoreAggregate performanceDomain = report.byDomain().stream()
            .filter(aggregate -> "performance".equals(aggregate.id()))
            .findFirst().orElseThrow();
        ScoreAggregate securityDomain = report.byDomain().stream()
            .filter(aggregate -> "security".equals(aggregate.id()))
            .findFirst().orElseThrow();
        assertEquals(1.0, performanceDomain.ratio(), 0.001);
        assertEquals(0.0, securityDomain.ratio(), 0.001);
    }

    @Test
    void unavailableDomainsAreRenormalizedOutOfGlobal() {
        AuditCheckResult performance = check("perf", AuditStatus.WARN, true, 10.0, "performance");

        AuditScoreReport report = service.compute(10, List.of(module("m", performance)));

        assertEquals(0.5, report.global().ratio(), 0.001);
        assertEquals(1.0, report.domainWeights().get("performance"), 0.001);
        assertEquals(0.0, report.domainWeights().get("security"), 0.001);
    }

    @Test
    void noMeasurableDomainMakesGlobalUnavailable() {
        AuditCheckResult informational = check("info", AuditStatus.INFO, false, 0.0, "performance");

        AuditScoreReport report = service.compute(10, List.of(module("m", informational)));

        assertEquals(0.0, report.global().score(), 0.001);
        assertEquals(0.0, report.global().maxScore(), 0.001);
        assertTrue(report.domainWeights().values().stream().allMatch(weight -> weight == 0.0));
    }

    @Test
    void addingACheckInOneDomainDoesNotChangeAnotherDomainContribution() {
        AuditCheckResult performance = check("perf", AuditStatus.PASS, true, 2.0, "performance");
        AuditCheckResult security = check("sec", AuditStatus.FAIL, true, 2.0, "security");
        AuditCheckResult extraPerformance = check("perf-extra", AuditStatus.PASS, true, 200.0, "performance");

        double before = service.compute(10, List.of(module("m", performance, security))).global().ratio();
        double after = service.compute(10, List.of(module("m", performance, security, extraPerformance))).global().ratio();

        assertEquals(before, after, 0.001);
    }

    // -------------------------
    // Cas dégénérés
    // -------------------------

    @Test
    void referenceDatasetsExposeNormalizedWeightsAndIgnoreZeroWeightFindings() {
        var performance = check("perf", AuditStatus.PASS, true, 100, "performance");
        var security = check("sec", AuditStatus.FAIL, true, 1, "security");
        var seo = check("seo", AuditStatus.WARN, true, 5, "seo");
        var a11y = check("a11y", AuditStatus.WARN, true, 18, "a11y").withScoreRatio(0.8);
        var zero = check("detail", AuditStatus.FAIL, true, 0, "security");
        var baseline = service.compute(10, "reference-v10", List.of(module("m", performance, security, seo, a11y)));
        var reordered = service.compute(10, "reference-v10", List.of(module("m", a11y, zero, seo, security, performance)));

        // (100 + 0 + 50 + 80) / 4 = 57.5, indépendamment des dénominateurs locaux.
        assertEquals(57.5, baseline.global().score(), 1e-9);
        assertEquals(baseline.byDomain(), reordered.byDomain());
        assertEquals(baseline.domainWeights(), reordered.domainWeights());
        assertEquals(baseline.global(), reordered.global());
        assertEquals(1.0, baseline.domainWeights().values().stream().mapToDouble(Double::doubleValue).sum(), 1e-9);
        assertTrue(baseline.domainWeights().values().stream().allMatch(weight -> weight == 0.25));

        var three = service.compute(10, List.of(module("m", performance, security, seo)));
        assertEquals(50.0, three.global().score(), 1e-9);
        assertEquals(1.0 / 3, three.domainWeights().get("seo"), 1e-9);
        assertEquals(0.0, three.domainWeights().get("a11y"));
    }

    @Test
    void shouldHandleEmptyModuleList() {
        AuditScoreReport report = service.compute(1, List.of());

        assertEquals(0.0, report.global().score(), 0.001);
        assertEquals(0.0, report.global().maxScore(), 0.001);
        assertTrue(report.byModule().isEmpty());
    }

    @Test
    void shouldHandleModuleWithNoChecks() {
        AuditScoreReport report = service.compute(1, List.of(module("empty")));

        assertEquals(0.0, report.global().score(), 0.001);
    }
}
