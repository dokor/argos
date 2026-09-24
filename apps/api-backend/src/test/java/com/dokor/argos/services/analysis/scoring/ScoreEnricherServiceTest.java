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
 * Couvre l'enrichissement des checks (couche où se logent les bugs de câblage clé→règle).
 * Utilise la vraie {@link DefaultScorePolicy} pour valider l'intégration bout-en-bout.
 */
class ScoreEnricherServiceTest {

    private final ScoreEnricherService enricher = new ScoreEnricherService(new DefaultScorePolicy());

    private static AuditCheckResult check(String key, AuditStatus status, List<String> tags) {
        return AuditCheckResult.of(
            key, key, status, AuditSeverity.MEDIUM,
            false, 0.0, tags,           // placeholders volontaires : l'enricher doit les recalculer
            null, Map.of(), "msg", null
        );
    }

    private AuditCheckResult enrichOne(String moduleId, AuditCheckResult check) {
        List<AuditModuleResult> out = enricher.enrich(List.of(
            new AuditModuleResult(moduleId, moduleId, moduleId, Map.of(), List.of(check))
        ));
        return out.get(0).checks().get(0);
    }

    @Test
    void scoringVersionShouldBe8() {
        assertEquals(8, enricher.scoringVersion());
    }

    @Test
    void infoCheckIsForcedNonScorableAndTaggedWithModule() {
        AuditCheckResult r = enrichOne("html", check("html.scripts.count", AuditStatus.INFO, List.of()));
        assertFalse(r.scorable());
        assertEquals(0.0, r.weight());
        assertTrue(r.tags().contains("html"));
    }

    @Test
    void scorableCheckGetsPolicyWeightAndTags() {
        AuditCheckResult r = enrichOne("http", check("http.security.hsts", AuditStatus.PASS, List.of()));
        assertTrue(r.scorable());
        assertEquals(8.0, r.weight());
        assertTrue(r.tags().contains("security"));
        assertTrue(r.tags().contains("http"));
    }

    @Test
    void runtimeEmittedKeyReceivesItsWeight_fixA() {
        // Clé réellement émise par RuntimeModuleAnalyzer - doit recevoir le poids 5 (pas le fallback 4).
        AuditCheckResult r = enrichOne("runtime", check("runtime.console.errors", AuditStatus.FAIL, List.of()));
        assertTrue(r.scorable());
        assertEquals(5.0, r.weight());
        // Rattaché au domaine métier Performance (#197) ; "runtime" reste en provenance.
        assertTrue(r.tags().contains("performance"));
        assertTrue(r.tags().contains("runtime"));
    }

    @Test
    void sslGradeIsScored_fixB() {
        AuditCheckResult r = enrichOne("ssl", check("ssl.grade", AuditStatus.FAIL, List.of()));
        assertTrue(r.scorable());
        assertEquals(10.0, r.weight());
        assertTrue(r.tags().contains("security"));
    }

    @Test
    void warnAvailabilityStubIsNotScored() {
        // ssl.available est émis en WARN (mode dégradé) : il ne doit jamais peser sur le score.
        AuditCheckResult r = enrichOne("ssl", check("ssl.available", AuditStatus.WARN, List.of()));
        assertFalse(r.scorable());
        assertEquals(0.0, r.weight());
    }

    @Test
    void existingCheckTagsAreMergedAndDeduplicated() {
        AuditCheckResult r = enrichOne("http", check("http.security.hsts", AuditStatus.PASS, List.of("security", "custom")));
        // pas de doublon "security", et le tag custom du check est conservé
        assertEquals(1, r.tags().stream().filter("security"::equals).count());
        assertTrue(r.tags().contains("custom"));
        assertTrue(r.tags().contains("http"));
    }

    @Test
    void lighthouseDetailedAccessibilityAuditIsVisibleUnderA11y() {
        AuditCheckResult r = enrichOne("lighthouse", check(
            "lighthouse.audit.color-contrast", AuditStatus.FAIL, List.of("lighthouse", "accessibility")));

        assertTrue(r.scorable());
        assertEquals(0.0, r.weight());
        assertTrue(r.tags().contains("a11y"));
        assertTrue(r.tags().contains("lighthouse"));
    }

    @Test
    void lighthouseDetailedBestPracticesAuditIsVisibleUnderSecurity() {
        AuditCheckResult r = enrichOne("lighthouse", check(
            "lighthouse.audit.no-vulnerable-libraries", AuditStatus.FAIL, List.of("lighthouse", "best-practices")));

        assertTrue(r.tags().contains("security"));
        assertTrue(r.tags().contains("lighthouse"));
    }
}
