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
        return AuditCheckResult.of(
            key, key, status, AuditSeverity.LOW,
            scorable, weight, List.of(tags),
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
        assertEquals(15.0, report.global().score(), 0.001);
        assertEquals(15.0, report.global().maxScore(), 0.001);
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
        assertEquals(5.0, report.global().score(), 0.001);
        assertEquals(10.0, report.global().maxScore(), 0.001);
    }

    @Test
    void infoChecksShouldNotContributeToScore() {
        AuditCheckResult info = check("k.info", AuditStatus.INFO, false, 0.0);
        AuditCheckResult pass = check("k.pass", AuditStatus.PASS, true, 8.0);

        AuditScoreReport report = service.compute(1, List.of(module("http", info, pass)));

        assertEquals(8.0, report.global().score(), 0.001);
        assertEquals(8.0, report.global().maxScore(), 0.001);
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

        assertEquals(5.9, report.global().score(), 0.001);   // 10 × 0.59, pas 0
        assertEquals(10.0, report.global().maxScore(), 0.001);
    }

    @Test
    void continuousScoreRatioRemovesCliffAtThresholds() {
        // 59/100 (FAIL) et 60/100 (WARN) ne doivent plus produire un écart de score abrupt.
        AuditCheckResult at59 = check("lh59", AuditStatus.FAIL, true, 15.0).withScoreRatio(0.59);
        AuditCheckResult at60 = check("lh60", AuditStatus.WARN, true, 15.0).withScoreRatio(0.60);

        double score59 = service.compute(1, List.of(module("m", at59))).global().score();
        double score60 = service.compute(1, List.of(module("m", at60))).global().score();

        assertEquals(0.15, score60 - score59, 0.001); // 15 × 0.01, continu (vs 7.5 avec les seuils)
    }

    @Test
    void continuousScoreRatioIsClampedToUnitInterval() {
        AuditCheckResult tooHigh = check("k.high", AuditStatus.PASS, true, 10.0).withScoreRatio(1.5);
        AuditCheckResult tooLow = check("k.low", AuditStatus.PASS, true, 10.0).withScoreRatio(-0.5);

        AuditScoreReport report = service.compute(1, List.of(module("m", tooHigh, tooLow)));

        assertEquals(10.0, report.global().score(), 0.001); // 10×1.0 (clampé) + 10×0.0 (clampé)
        assertEquals(20.0, report.global().maxScore(), 0.001);
    }

    @Test
    void nonFiniteRatiosAndWeightsCannotCorruptAggregates() {
        AuditCheckResult invalidRatio = check("ratio", AuditStatus.PASS, true, 10.0).withScoreRatio(Double.NaN);
        AuditCheckResult invalidWeight = check("weight", AuditStatus.PASS, true, Double.POSITIVE_INFINITY);
        AuditCheckResult negativeWeight = check("negative", AuditStatus.PASS, true, -4.0);

        AuditScoreReport report = service.compute(1, List.of(module("m", invalidRatio, invalidWeight, negativeWeight)));

        assertEquals(10.0, report.global().score(), 0.001);
        assertEquals(10.0, report.global().maxScore(), 0.001);
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

    // -------------------------
    // Cas dégénérés
    // -------------------------

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
