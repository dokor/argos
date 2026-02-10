package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Politique MVP :
 * - INFO => non scoré (géré plus haut par ScoreEnricherService)
 * - Poids/tags déterminés par:
 *   1) overrides exacts sur key
 *   2) fallback par préfixe (http.security.*, html.meta.*, html.images.*, ...)
 *
 * Ajuste les poids progressivement au fil du temps.
 */
@Singleton
public class ScorePolicyV1 implements ScorePolicy {

    private static final Logger logger = LoggerFactory.getLogger(ScorePolicyV1.class);

    private static final int VERSION = 1;

    private final Map<String, ScoreRule> overrides;

    public ScorePolicyV1() {
        Map<String, ScoreRule> map = new HashMap<>();

        // ----- HTTP Security (exemples) -----
        map.put("http.security.hsts", rule(true, 8, "security", "http"));
        map.put("http.security.csp", rule(true, 10, "security", "http"));
        map.put("http.security.x_frame_options", rule(true, 6, "security", "http"));
        map.put("http.security.x_content_type_options", rule(true, 4, "security", "http"));
        map.put("http.security.referrer_policy", rule(true, 3, "security", "http"));

        // ----- SEO (HTML) -----
        map.put("html.title", rule(true, 4, "seo", "html"));
        map.put("html.meta.description.present", rule(true, 3, "seo", "html"));
        map.put("html.link.canonical.present", rule(true, 2, "seo", "html"));
        map.put("html.h1.count", rule(true, 3, "seo", "html"));

        // ----- Accessibility (HTML) -----
        map.put("html.images.alt_coverage", rule(true, 4, "a11y", "html"));
        map.put("html.anchors.href_coverage", rule(true, 2, "a11y", "html"));
        map.put("html.lang", rule(true, 2, "a11y", "html"));

        // ----- Tech (souvent informatif) -----
        map.put("tech.cms", rule(false, 0, "tech"));
        map.put("tech.frontend.framework", rule(false, 0, "tech"));
        map.put("tech.backend.hints", rule(false, 0, "tech"));
        map.put("tech.cdn.cloudflare", rule(false, 0, "tech"));

        this.overrides = Map.copyOf(map);

        logger.info("ScorePolicyV1 initialized overrides={}", overrides.size());
    }

    @Override
    public int version() {
        return VERSION;
    }

    @Override
    public ScoreRule ruleFor(String moduleId, String checkKey) {
        ScoreRule exact = overrides.get(checkKey);
        if (exact != null) return exact;

        // ---- Fallback rules by prefix ----
        if (checkKey.startsWith("http.security.")) {
            return rule(true, 6, "security", "http");
        }
        if (checkKey.startsWith("http.")) {
            // HTTP "structure" (redirect count, status, timings) => plutôt perf / reliability
            return rule(true, 2, "http");
        }

        if (checkKey.startsWith("html.meta.") || checkKey.startsWith("html.link.canonical")) {
            return rule(true, 2, "seo", "html");
        }
        if (checkKey.startsWith("html.images.") || checkKey.startsWith("html.anchors.") || checkKey.equals("html.lang")) {
            return rule(true, 2, "a11y", "html");
        }
        if (checkKey.startsWith("html.")) {
            return rule(true, 1, "html");
        }

        if (checkKey.startsWith("tech.")) {
            // tech = informatif par défaut
            return rule(false, 0, "tech");
        }

        // unknown => non scoré par défaut (évite de polluer le score)
        return rule(false, 0, "misc");
    }

    private static ScoreRule rule(boolean scorable, double weight, String... tags) {
        return new ScoreRule(scorable, weight, List.of(tags));
    }
}
