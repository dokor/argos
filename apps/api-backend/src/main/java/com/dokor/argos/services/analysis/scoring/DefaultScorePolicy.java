package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Politique de scoring unique d'Argos — aplatissement des versions V2→V6 (issue #188).
 * <p>
 * Historiquement le barème était réparti sur une chaîne d'héritage
 * ({@code ScorePolicyV2 → V3 → V4 → V5 → V6}), chaque cran ajoutant un delta minime.
 * Une seule version était réellement active en production (V6, bind Guice) et les
 * rapports produits sont figés en base sous forme de JSON (avec leur {@code scoringVersion}) —
 * aucun code ne relit cette version pour rejouer un ancien audit. La chaîne d'héritage
 * n'apportait donc que de la dette : elle est ici aplatie en une classe unique.
 * <p>
 * {@link #version()} reste fixé à <b>6</b> pour préserver la continuité des
 * {@code scoringVersion} déjà écrits en base : un rapport marqué "6" reste cohérent
 * avec le barème appliqué par cette classe.
 *
 * <h3>Principes</h3>
 * <ul>
 *   <li>Le poids et les tags d'un check sont déterminés <b>uniquement</b> par sa clé :
 *       (1) override exact, puis (2) fallback par préfixe. La sévérité sert à l'affichage,
 *       jamais au calcul du poids.</li>
 *   <li>INFO ⇒ non scoré (forcé en amont par {@link ScoreEnricherService}).</li>
 *   <li>Les stubs de disponibilité / mode dégradé ({@code *.available}, {@code *.collect})
 *       sont explicitement non scorés : bien qu'émis en WARN, ils ne doivent jamais peser
 *       sur le score (une panne de service externe ne doit pas faire chuter la note).</li>
 *   <li>Les checks {@code runtime.*} relèvent de la catégorie {@code runtime} seule
 *       (issue #172) — la catégorie « Performance » est alimentée par Lighthouse.</li>
 * </ul>
 *
 * <h3>Barème par tag (checks scorés)</h3>
 * <pre>
 * security     : http.security.hsts(8) csp(10) x_frame_options(6) x_content_type_options(4)
 *                referrer_policy(3) · ssl.grade(10) certificate.valid(6) certificate.expiry_days(3)
 *                protocols.tls13(2) protocols.tls12(2) · observatory.score(8)
 *                · lighthouse.score.best-practices(6) · tech.security.version_disclosure(3)
 * seo          : html.title(4) meta.description.present(3) link.canonical.present(2) h1.count(3)
 *                · http.seo.robots_txt(2) sitemap(3) · lighthouse.score.seo(8)
 * a11y         : html.images.alt_coverage(4) anchors.href_coverage(2) lang(2)
 *                · lighthouse.score.accessibility(10)
 * performance  : lighthouse.score.performance(15)
 * runtime      : runtime.console.errors(5) js.errors(6) network.5xx(8) network.failed_requests(4)
 * </pre>
 */
@Singleton
public class DefaultScorePolicy implements ScorePolicy {

    private static final Logger logger = LoggerFactory.getLogger(DefaultScorePolicy.class);

    /** Fixé à 6 : continuité des {@code scoringVersion} déjà persistés (issue #188). */
    private static final int VERSION = 6;

    private final Map<String, ScoreRule> overrides;

    public DefaultScorePolicy() {
        // LinkedHashMap pour un ordre d'itération stable (logs, tests reproductibles)
        Map<String, ScoreRule> map = new LinkedHashMap<>();

        // ----- HTTP Security -----
        map.put("http.security.hsts",                  rule(true, 8,  "security", "http"));
        map.put("http.security.csp",                   rule(true, 10, "security", "http"));
        map.put("http.security.x_frame_options",       rule(true, 6,  "security", "http"));
        map.put("http.security.x_content_type_options", rule(true, 4, "security", "http"));
        map.put("http.security.referrer_policy",       rule(true, 3,  "security", "http"));

        // ----- SEO (HTML) -----
        map.put("html.title",                    rule(true, 4, "seo", "html"));
        map.put("html.meta.description.present", rule(true, 3, "seo", "html"));
        map.put("html.link.canonical.present",   rule(true, 2, "seo", "html"));
        map.put("html.h1.count",                 rule(true, 3, "seo", "html"));

        // ----- SEO (ressources : robots.txt / sitemap.xml, émises par le module HTTP) -----
        map.put("http.seo.robots_txt", rule(true, 2, "seo", "http"));
        map.put("http.seo.sitemap",    rule(true, 3, "seo", "http"));

        // ----- Accessibility (HTML) -----
        map.put("html.images.alt_coverage",   rule(true, 4, "a11y", "html"));
        map.put("html.anchors.href_coverage", rule(true, 2, "a11y", "html"));
        map.put("html.lang",                  rule(true, 2, "a11y", "html"));

        // ----- Lighthouse (clés = ids de catégorie Lighthouse, avec tiret) -----
        map.put("lighthouse.score.performance",    rule(true, 15, "performance", "lighthouse"));
        map.put("lighthouse.score.accessibility",  rule(true, 10, "a11y",        "lighthouse"));
        map.put("lighthouse.score.best-practices", rule(true, 6,  "security",    "lighthouse"));
        map.put("lighthouse.score.seo",            rule(true, 8,  "seo",         "lighthouse"));
        map.put("lighthouse.collect",              rule(false, 0, "lighthouse")); // stub dispo

        // ----- Runtime (Playwright) — catégorie "runtime" seule, PAS "performance" (issue #172) -----
        map.put("runtime.console.errors",           rule(true, 5, "runtime"));
        map.put("runtime.js.errors",                rule(true, 6, "runtime"));
        map.put("runtime.network.5xx",              rule(true, 8, "runtime"));
        map.put("runtime.network.failed_requests",  rule(true, 4, "runtime"));
        map.put("runtime.collect",                  rule(false, 0, "runtime")); // stub dispo (WARN)

        // ----- SSL / TLS (Qualys SSL Labs) -----
        map.put("ssl.grade",                  rule(true, 10, "security", "ssl"));
        map.put("ssl.certificate.valid",      rule(true, 6,  "security", "ssl"));
        map.put("ssl.certificate.expiry_days", rule(true, 3, "security", "ssl"));
        map.put("ssl.protocols.tls13",        rule(true, 2,  "security", "ssl"));
        map.put("ssl.protocols.tls12",        rule(true, 2,  "security", "ssl"));
        map.put("ssl.available",              rule(false, 0, "ssl")); // stub dispo (WARN)

        // ----- Observatory (Mozilla) -----
        map.put("observatory.score",     rule(true, 8, "security", "observatory"));
        map.put("observatory.available", rule(false, 0, "observatory")); // stub dispo (WARN)

        // ----- ZAP : alertes génériques informatives (findings d'en-têtes via http.security.*) -----
        map.put("zap.available", rule(false, 0, "zap")); // stub dispo (WARN)

        // ----- HTML : stub HTML vide -----
        map.put("html.available", rule(false, 0, "html")); // stub dispo (WARN)

        // ----- Tech -----
        // Divulgation de version logicielle via en-têtes : scorable sécurité (ex-V4, issue #158).
        map.put("tech.security.version_disclosure", rule(true, 3, "security", "tech"));
        map.put("tech.cms",                rule(false, 0, "tech"));
        map.put("tech.frontend.framework", rule(false, 0, "tech"));
        map.put("tech.backend.hints",      rule(false, 0, "tech"));
        map.put("tech.cdn.cloudflare",     rule(false, 0, "tech"));

        this.overrides = Map.copyOf(map);

        logger.info("DefaultScorePolicy initialized scoringVersion={} overrides={}", VERSION, overrides.size());
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

        // Audits Lighthouse individuels (ex-V5, issue #154) : scorables pour être surfacés
        // comme issues actionnables, mais de poids nul — les 4 notes de catégorie portent
        // déjà le poids agrégé de Lighthouse (pas de double comptage). Doit précéder le
        // fallback lighthouse.* générique.
        if (checkKey != null && checkKey.startsWith("lighthouse.audit.")) {
            return rule(true, 0, "lighthouse");
        }

        if (checkKey.startsWith("http.security.")) {
            return rule(true, 6, "security", "http");
        }
        if (checkKey.startsWith("http.")) {
            // HTTP "structure" (redirect count, status, timings) => http / reliability
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

        if (checkKey.startsWith("lighthouse.")) {
            // checks lighthouse inconnus = informatifs, ne polluent pas le score
            return rule(false, 0, "lighthouse");
        }

        if (checkKey.startsWith("runtime.")) {
            // Catégorie "runtime" seule (issue #172).
            return rule(true, 4, "runtime");
        }

        if (checkKey.startsWith("ssl.")) {
            return rule(true, 3, "security", "ssl");
        }

        // Observatory / ZAP inconnus = informatifs (leur valeur "sécurité" passe par
        // observatory.score et les clés partagées http.security.*).
        if (checkKey.startsWith("observatory.")) {
            return rule(false, 0, "security", "observatory");
        }
        if (checkKey.startsWith("zap.")) {
            return rule(false, 0, "security", "zap");
        }

        if (checkKey.startsWith("tech.")) {
            return rule(false, 0, "tech");
        }

        // unknown => non scoré par défaut (évite de polluer le score)
        return rule(false, 0, "misc");
    }

    private static ScoreRule rule(boolean scorable, double weight, String... tags) {
        return new ScoreRule(scorable, weight, List.of(tags));
    }
}
