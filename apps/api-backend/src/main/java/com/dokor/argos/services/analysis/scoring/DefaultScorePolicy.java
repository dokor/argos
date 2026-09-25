package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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
 * l'ensemble des deltas jusqu'à V8 inclus. La V9 introduit le catalogue explicite
 * et son empreinte déterministe.
 * <p>
 * {@link #version()} est fixé à <b>9</b> pour préserver la continuité des
 * {@code scoringVersion} déjà écrits en base : un rapport marqué "9" reste cohérent
 * avec le barème appliqué par cette classe.
 *
 * <h3>Principes</h3>
 * <ul>
 *   <li>Le poids, l'applicabilité, le domaine métier et la provenance sont déterminés
 *       <b>uniquement</b> par une clé exacte du catalogue. La sévérité sert à l'affichage,
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

    /** Version incrémentée : passage à un catalogue explicite (issue #248). */
    private static final int VERSION = 9;

    private final Map<String, ScoreRule> catalogue;
    private final String fingerprint;

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

        // Les anciennes règles de préfixe rendaient implicitement ces clés
        // scorables. Elles sont désormais toutes déclarées et revues ici.
        map.put("http.antibot.challenge",   rule(true, 2, "performance", "http"));
        map.put("http.protocol.version",    rule(true, 2, "performance", "http"));
        map.put("http.errors",              rule(true, 2, "performance", "http"));
        map.put("http.response_time_ms",    rule(true, 2, "performance", "http"));
        map.put("http.protocol.http2",      rule(true, 2, "performance", "http"));
        map.put("http.headers.compression", rule(true, 2, "performance", "http"));
        map.put("http.headers.caching",     rule(true, 2, "performance", "http"));
        map.put("http.headers.server",      rule(true, 2, "performance", "http"));

        map.put("html.meta.robots.present", rule(true, 2, "seo", "html"));
        map.put("html.scripts.count",       rule(true, 1, "seo", "html"));
        map.put("html.size.bytes",          rule(true, 1, "seo", "html"));
        map.put("html.analysis.duration_ms", rule(true, 1, "seo", "html"));
        map.put("html.meta.charset.present", rule(true, 2, "seo", "html"));

        map.put("runtime.network.request_count", rule(true, 4, "performance", "runtime"));
        map.put("runtime.network.bytes_estimated", rule(true, 4, "performance", "runtime"));
        map.put("runtime.analysis.duration_ms", rule(true, 4, "performance", "runtime"));

        map.put("observatory.grade", rule(false, 0, "observatory"));
        map.put("observatory.tests.passed", rule(false, 0, "observatory"));
        map.put("zap.scan.result", rule(false, 0, "zap"));

        // ----- Tech -----
        // Divulgation de version logicielle via en-têtes : scorable sécurité (ex-V4, issue #158).
        map.put("tech.security.version_disclosure", rule(true, 3, "security", "tech"));
        map.put("tech.cms",                rule(false, 0, "tech"));
        map.put("tech.frontend.framework", rule(false, 0, "tech"));
        map.put("tech.backend.hints",      rule(false, 0, "tech"));
        map.put("tech.cdn.cloudflare",     rule(false, 0, "tech"));
        map.put("tech.frontend.nextjs",     rule(false, 0, "tech"));
        map.put("tech.http.server_header",  rule(false, 0, "tech"));
        map.put("tech.html.available",      rule(false, 0, "tech"));
        map.put("tech.analysis.duration_ms", rule(false, 0, "tech"));

        this.catalogue = Collections.unmodifiableMap(new TreeMap<>(map));
        this.fingerprint = fingerprintOf(catalogue);

        logger.info("DefaultScorePolicy initialized scoringVersion={} catalogue={} fingerprint={}",
            VERSION, catalogue.size(), fingerprint);
    }

    @Override
    public int version() {
        return VERSION;
    }

    @Override
    public String fingerprint() {
        return fingerprint;
    }

    @Override
    public Set<String> cataloguedKeys() {
        return catalogue.keySet();
    }

    @Override
    public ScoreRule ruleFor(String moduleId, String checkKey) {
        ScoreRule exact = checkKey == null ? null : catalogue.get(checkKey);
        if (exact != null) return exact;

        // Les audits Lighthouse détaillés ont des ids dynamiques. Cette unique règle de
        // pattern est volontaire : elle les expose à poids nul, sans jamais scorer une
        // nouvelle clé Lighthouse automatiquement.
        if (checkKey != null && checkKey.startsWith("lighthouse.audit.")) {
            return diagnostic(BusinessCategory.NONE, TechnicalSource.LIGHTHOUSE);
        }

        return informational(TechnicalSource.fromTag(moduleId));

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
        BusinessCategory category = tags.length > 0
            ? BusinessCategory.fromTag(tags[0]).orElse(BusinessCategory.NONE)
            : BusinessCategory.NONE;
        TechnicalSource source = tags.length > 1
            ? TechnicalSource.fromTag(tags[1])
            : (tags.length == 1 ? TechnicalSource.fromTag(tags[0]) : TechnicalSource.MISC);
        if (scorable && weight > 0.0) {
            return new ScoreRule(ScoreApplicability.SCORE, weight, category, source);
        }
        return scorable ? diagnostic(category, source) : informational(source);
    }

    private static ScoreRule diagnostic(BusinessCategory category, TechnicalSource source) {
        return new ScoreRule(ScoreApplicability.VISIBLE_DIAGNOSTIC, 0.0, category, source);
    }

    private static ScoreRule informational(TechnicalSource source) {
        return new ScoreRule(ScoreApplicability.INFORMATIONAL, 0.0, BusinessCategory.NONE, source);
    }

    private static String fingerprintOf(Map<String, ScoreRule> rules) {
        String canonical = "version=" + VERSION + "\n" + rules.entrySet().stream()
            .map(entry -> entry.getKey() + "|" + entry.getValue().applicability() + "|"
                + entry.getValue().weight() + "|" + entry.getValue().businessCategory() + "|"
                + entry.getValue().technicalSource())
            .collect(java.util.stream.Collectors.joining("\n"));
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                .digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required for the scoring fingerprint", e);
        }
    }
}
