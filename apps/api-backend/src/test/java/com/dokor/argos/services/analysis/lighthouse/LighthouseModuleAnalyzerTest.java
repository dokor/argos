package com.dokor.argos.services.analysis.lighthouse;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.net.http.HttpTimeoutException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.*;

class LighthouseModuleAnalyzerTest {

    private static AuditContext ctx() {
        return new AuditContext("http://example.com", "http://example.com", 1L);
    }

    @Test
    void marksTimeoutWhenClientTimesOut() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenThrow(new HttpTimeoutException("request timed out"));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("TIMEOUT", res.data().get("reason"));
        assertEquals(1, res.checks().size());
        assertEquals(AuditStatus.WARN, res.checks().get(0).status());
    }

    @Test
    void marksFailedOnGenericError() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenThrow(new IllegalStateException("service 500"));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("FAILED", res.data().get("reason"));
    }

    // -------------------------
    // Réponse HTTP 200 mais inexploitable (issue #205)
    // -------------------------

    /** Corps vide ({}) : aucun score exploitable => module marqué indisponible, pas de check scorable. */
    @Test
    void treatsEmptyBodyAsUnavailable() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenReturn(new ObjectMapper().readTree("{}"));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("UNAVAILABLE", res.data().get("reason"));
        // Un seul check "collect" non scorable, aucun lighthouse.score.* qui pénaliserait le score.
        assertEquals(1, res.checks().size());
        assertEquals("lighthouse.collect", res.checks().get(0).key());
        assertEquals(0, res.checks().stream().filter(c -> c.key().startsWith("lighthouse.score.")).count());
    }

    /** Corps sans nœud "categories" : même traitement que le corps vide. */
    @Test
    void treatsBodyWithoutCategoriesAsUnavailable() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString()))
            .thenReturn(new ObjectMapper().readTree("{\"lighthouseVersion\":\"11.0.0\",\"audits\":{}}"));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals("UNAVAILABLE", res.data().get("reason"));
        assertEquals(0, res.checks().stream().filter(c -> c.key().startsWith("lighthouse.score.")).count());
    }

    /** Catégories présentes mais toutes en score null (catégories en erreur) : indisponible, pas de 0 fabriqué. */
    @Test
    void treatsNullCategoryScoresAsUnavailable() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        String json = "{\"categories\":{"
            + "\"performance\":{\"score\":null,\"title\":\"Performance\"},"
            + "\"seo\":{\"score\":null}}}";
        when(client.analyze(anyString())).thenReturn(new ObjectMapper().readTree(json));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.FALSE, res.data().get("available"));
        assertEquals(0, res.checks().stream().filter(c -> c.key().startsWith("lighthouse.score.")).count());
    }

    /** Réponse partielle (2 catégories notées sur 4) : on émet uniquement les notes présentes, sans NPE ni 0 fabriqué. */
    @Test
    void surfacesOnlyPresentCategoriesOnPartialResponse() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        String json = "{\"categories\":{"
            + "\"performance\":{\"score\":0.42,\"title\":\"Performance\"},"
            + "\"seo\":{\"score\":0.9,\"title\":\"SEO\"}}}";
        when(client.analyze(anyString())).thenReturn(new ObjectMapper().readTree(json));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        assertEquals(Boolean.TRUE, res.data().get("available"));
        // Seules les catégories réellement fournies deviennent des checks scorés.
        assertEquals(2, res.checks().stream().filter(c -> c.key().startsWith("lighthouse.score.")).count());
        assertEquals(0, res.checks().stream()
            .filter(c -> c.key().equals("lighthouse.score.accessibility")
                || c.key().equals("lighthouse.score.best-practices"))
            .count());

        @SuppressWarnings("unchecked")
        Map<String, Object> scores = (Map<String, Object>) res.data().get("scores");
        assertEquals(2, scores.size());
        assertEquals(42, scores.get("performance"));
        // Pas de note fabriquée à 0 pour les catégories absentes.
        assertNull(scores.get("accessibility"));
    }

    /**
     * Anti-falaise (issue #100) : le status reste dérivé de seuils pour l'affichage,
     * mais chaque score Lighthouse porte un ratio continu (score/100) utilisé pour le scoring.
     */
    @Test
    void attachesContinuousScoreRatioFromLighthouseScore() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        String json = "{\"categories\":{"
            + "\"performance\":{\"score\":0.59,\"title\":\"Performance\"},"
            + "\"accessibility\":{\"score\":0.90,\"title\":\"Accessibility\"},"
            + "\"best-practices\":{\"score\":0.80,\"title\":\"Best Practices\"},"
            + "\"seo\":{\"score\":1.0,\"title\":\"SEO\"}}}";
        when(client.analyze(anyString())).thenReturn(new ObjectMapper().readTree(json));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        AuditCheckResult perf = res.checks().stream()
            .filter(c -> "lighthouse.score.performance".equals(c.key()))
            .findFirst().orElseThrow();

        // 59/100 => badge FAIL (affichage) mais ratio continu 0.59 (scoring, pas 0)
        assertEquals(AuditStatus.FAIL, perf.status());
        assertNotNull(perf.scoreRatio());
        assertEquals(0.59, perf.scoreRatio(), 0.0001);

        AuditCheckResult seo = res.checks().stream()
            .filter(c -> "lighthouse.score.seo".equals(c.key()))
            .findFirst().orElseThrow();
        assertEquals(1.0, seo.scoreRatio(), 0.0001);
    }

    // -------------------------
    // Audits individuels (issue #154)
    // -------------------------

    /** LHR avec une catégorie perf + 3 audits : un échec net, un échec léger, un réussi. */
    private static String lhrWithAudits() {
        return "{\"categories\":{\"performance\":{\"score\":0.5,\"title\":\"Performance\",\"auditRefs\":["
            + "{\"id\":\"uses-responsive-images\",\"weight\":10,\"group\":\"load-opportunities\"},"
            + "{\"id\":\"uses-text-compression\",\"weight\":3},"
            + "{\"id\":\"is-on-https\",\"weight\":1},"
            + "{\"id\":\"network-requests\",\"weight\":0}]},"
            + "\"accessibility\":{\"score\":0.9,\"title\":\"Accessibilité\"},"
            + "\"best-practices\":{\"score\":0.9,\"title\":\"Bonnes pratiques\"},"
            + "\"seo\":{\"score\":1.0,\"title\":\"SEO\"}},"
            + "\"audits\":{"
            + "\"uses-responsive-images\":{\"id\":\"uses-responsive-images\",\"title\":\"Dimensionner correctement les images\",\"description\":\"Servez des images adaptées. [En savoir plus](https://x.dev/y).\",\"score\":0.2,\"scoreDisplayMode\":\"metricSavings\"},"
            + "\"uses-text-compression\":{\"id\":\"uses-text-compression\",\"title\":\"Activer la compression du texte\",\"description\":\"Compressez les ressources texte.\",\"score\":0.7,\"scoreDisplayMode\":\"metricSavings\"},"
            + "\"is-on-https\":{\"id\":\"is-on-https\",\"title\":\"Utilise HTTPS\",\"description\":\"ok\",\"score\":1.0,\"scoreDisplayMode\":\"binary\"},"
            + "\"network-requests\":{\"id\":\"network-requests\",\"title\":\"Requêtes réseau\",\"description\":\"info\",\"score\":null,\"scoreDisplayMode\":\"informative\"}}}";
    }

    @Test
    void surfacesFailingAuditsAsChecks() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenReturn(new ObjectMapper().readTree(lhrWithAudits()));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        // L'audit en échec net (score 0.2 < 0.5) => check FAIL, libellé et reco nettoyée.
        AuditCheckResult resp = res.checks().stream()
            .filter(c -> "lighthouse.audit.uses-responsive-images".equals(c.key()))
            .findFirst().orElseThrow();
        assertEquals(AuditStatus.FAIL, resp.status());
        assertEquals("Servez des images adaptées. En savoir plus.", resp.recommendation());

        // L'audit en échec léger (0.7) => présent en WARN.
        assertEquals(AuditStatus.WARN, res.checks().stream()
            .filter(c -> "lighthouse.audit.uses-text-compression".equals(c.key()))
            .findFirst().orElseThrow().status());
    }

    @Test
    void ignoresPassingAndInformativeAudits() throws Exception {
        LighthouseClient client = mock(LighthouseClient.class);
        when(client.analyze(anyString())).thenReturn(new ObjectMapper().readTree(lhrWithAudits()));

        AuditModuleResult res = new LighthouseModuleAnalyzer(client)
            .analyze(ctx(), LoggerFactory.getLogger("test"));

        // Audit réussi (is-on-https, score 1.0) et audit informatif (score null) => non remontés.
        assertEquals(0, res.checks().stream()
            .filter(c -> c.key().equals("lighthouse.audit.is-on-https")
                || c.key().equals("lighthouse.audit.network-requests"))
            .count());
        assertEquals(2, res.data().get("auditsSurfaced"));
    }
}
