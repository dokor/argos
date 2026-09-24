package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Politique de scoring unique d'Argos — aplatissement des versions V2→V6 (issue #188).
 * <p>
 * Historiquement le barème était réparti sur une chaîne d'héritage
 * ({@code ScorePolicyV2 → V3 → V4 → V5 → V6 → V7 → V8}), chaque cran ajoutant un delta
 * minime. Une seule version était réellement active en production (bind Guice) et les
 * rapports produits sont figés en base sous forme de JSON (avec leur {@code scoringVersion}) —
 * aucun code ne relit cette version pour rejouer un ancien audit. La chaîne d'héritage
 * n'apportait donc que de la dette : elle est ici aplatie en une classe unique intégrant
 * l'ensemble des deltas jusqu'à V8 inclus.
 * <p>
 * {@link #version()} est fixé à <b>8</b> pour préserver la continuité des
 * {@code scoringVersion} déjà écrits en base : un rapport marqué "8" reste cohérent
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
 *   <li>Les catégories affichées sont les seuls <b>domaines métier</b> (performance,
 *       security, seo, a11y) — issue #197. Les tags d'outil (lighthouse, ssl, observatory,
 *       zap, runtime) ne sont plus des catégories, ils restent une info de provenance
 *       (filtrage dans {@code PublicReportComposer#isBusinessTag}). Les checks
 *       {@code runtime.*} sont donc rattachés au domaine {@code performance} (sinon leurs
 *       points seraient orphelins, faute de catégorie « Runtime »).</li>
 * </ul>
 *
 * <h3>Barème par domaine (checks scorés)</h3>
 * <pre>
 * security     : http.security.hsts(8) csp(10) x_frame_options(6) x_content_type_options(4)
 *                referrer_policy(3) · ssl.grade(10) certificate.valid(6) certificate.expiry_days(3)
 *                protocols.tls13(2) protocols.tls12(2) · observatory.score(8)
 *                · lighthouse.score.best-practices(6) · tech.security.version_disclosure(3)
 * seo          : html.title(4) meta.description.present(3) link.canonical.present(2) h1.count(3)
 *                · http.seo.robots_txt(2) sitemap(3) · lighthouse.score.seo(8)
 * a11y         : html.images.alt_coverage(4) anchors.href_coverage(2) lang(2)
 *                · lighthouse.score.accessibility(10)
 * performance  : lighthouse.score.performance(22, #199) · runtime.console.errors(5)
 *                js.errors(6) network.5xx(8) network.failed_requests(4)
 * </pre>
 */
@Singleton
public class DefaultScorePolicy implements ScorePolicy {

    private static final Logger logger = LoggerFactory.getLogger(DefaultScorePolicy.class);

    /** Fixé à 8 : continuité des {@code scoringVersion} déjà persistés (aplatissement V2→V8). */
    private static final int VERSION = 8;

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
        map.put("http.security.permissions_policy",    rule(true, 6,  "security", "http"));
        map.put("http.security.cookie_flags",          rule(true, 6,  "security", "http"));

        // HTTP structure : faute de catégorie Reliability dans le produit, ces
        // signaux d'accessibilité et de chemin de chargement sont rattachés à Performance.
        map.put("http.status_code",              rule(true, 2, "performance", "http"));
        map.put("http.redirect.count",           rule(true, 2, "performance", "http"));
        map.put("http.final_url.https",          rule(true, 2, "security", "http"));
        map.put("http.redirect.to_https",        rule(true, 2, "security", "http"));
        map.put("http.headers.content_type",     rule(true, 2, "seo", "http"));

        // ----- SEO (HTML) -----
        map.put("html.title",                    rule(true, 4, "seo", "html"));
        map.put("html.meta.description.present", rule(true, 3, "seo", "html"));
        map.put("html.link.canonical.present",   rule(true, 2, "seo", "html"));
        map.put("html.h1.count",                 rule(true, 3, "seo", "html"));
        map.put("html.meta.viewport.present",    rule(true, 2, "a11y", "html"));
        map.put("html.doctype.html5",            rule(true, 1, "a11y", "html"));
        map.put("html.social.meta",              rule(true, 1, "seo", "html"));

        // ----- SEO (ressources : robots.txt / sitemap.xml, émises par le module HTTP) -----
        map.put("http.seo.robots_txt", rule(true, 2, "seo", "http"));
        map.put("http.seo.sitemap",    rule(true, 3, "seo", "http"));

        // ----- Accessibility (HTML) -----
        map.put("html.images.alt_coverage",   rule(true, 4, "a11y", "html"));
        map.put("html.anchors.href_coverage", rule(true, 2, "a11y", "html"));
        map.put("html.lang",                  rule(true, 2, "a11y", "html"));

        // ----- Lighthouse (clés = ids de catégorie Lighthouse, avec tiret) -----
        // Poids perf relevé 15 -> 22 pour donner plus d'impact à la performance (issue #199).
        map.put("lighthouse.score.performance",    rule(true, 22, "performance", "lighthouse"));
        map.put("lighthouse.score.accessibility",  rule(true, 10, "a11y",        "lighthouse"));
        map.put("lighthouse.score.best-practices", rule(true, 6,  "security",    "lighthouse"));
        map.put("lighthouse.score.seo",            rule(true, 8,  "seo",         "lighthouse"));
        map.put("lighthouse.collect",              rule(false, 0, "lighthouse")); // stub dispo

        // ----- Runtime (Playwright) — domaine "performance" + provenance "runtime" (issue #197) -----
        // Rattaché au domaine métier Performance : depuis la catégorisation par domaine
        // (#197) il n'existe plus de catégorie « Runtime », donc sans ce domaine les points
        // runtime seraient orphelins. Le tag "runtime" ne sert plus que de provenance.
        map.put("runtime.console.errors",           rule(true, 5, "performance", "runtime"));
        map.put("runtime.js.errors",                rule(true, 6, "performance", "runtime"));
        map.put("runtime.network.5xx",              rule(true, 8, "performance", "runtime"));
        map.put("runtime.network.failed_requests",  rule(true, 4, "performance", "runtime"));
        // Signal diagnostique explicitement visible, mais sans impact sur la note.
        map.put("runtime.network.third_party_errors", rule(true, 0, "performance", "runtime"));
        map.put("runtime.collect",                  rule(false, 0, "runtime")); // stub dispo (WARN)

        // ----- SSL / TLS (Qualys SSL Labs) -----
        map.put("ssl.grade",                  rule(true, 10, "security", "ssl"));
        map.put("ssl.certificate.valid",      rule(true, 6,  "security", "ssl"));
        map.put("ssl.certificate.expiry_days", rule(true, 3, "security", "ssl"));
        map.put("ssl.protocols.tls13",        rule(true, 2,  "security", "ssl"));
        map.put("ssl.protocols.tls12",        rule(true, 2,  "security", "ssl"));
        map.put("ssl.protocols.legacy_disabled", rule(true, 3, "security", "ssl"));
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
            // Les futures clés HTTP restent expliquées sous Performance jusqu'à
            // l'éventuelle introduction d'un domaine Reliability.
            return rule(true, 2, "performance", "http");
        }

        if (checkKey.startsWith("html.meta.") || checkKey.startsWith("html.link.canonical")) {
            return rule(true, 2, "seo", "html");
        }
        if (checkKey.startsWith("html.images.") || checkKey.startsWith("html.anchors.") || checkKey.equals("html.lang")) {
            return rule(true, 2, "a11y", "html");
        }
        if (checkKey.startsWith("html.")) {
            return rule(true, 1, "seo", "html");
        }

        if (checkKey.startsWith("lighthouse.")) {
            // checks lighthouse inconnus = informatifs, ne polluent pas le score
            return rule(false, 0, "lighthouse");
        }

        if (checkKey.startsWith("runtime.")) {
            // Domaine Performance + provenance runtime (issue #197).
            return rule(true, 4, "performance", "runtime");
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

    @Override
    public Optional<String> businessCategoryFor(String moduleId, String checkKey, List<String> sourceTags) {
        if (checkKey != null && checkKey.startsWith("lighthouse.audit.")) {
            if (sourceTags == null) return Optional.empty();
            return sourceTags.stream()
                .map(String::trim)
                .map(category -> switch (category) {
                    case "accessibility" -> "a11y";
                    case "best-practices" -> "security";
                    case "performance", "security", "seo", "a11y" -> category;
                    default -> null;
                })
                .filter(Objects::nonNull)
                .findFirst();
        }
        return ScorePolicy.super.businessCategoryFor(moduleId, checkKey, sourceTags);
    }

    private static ScoreRule rule(boolean scorable, double weight, String... tags) {
        return new ScoreRule(scorable, weight, List.of(tags));
    }
}
