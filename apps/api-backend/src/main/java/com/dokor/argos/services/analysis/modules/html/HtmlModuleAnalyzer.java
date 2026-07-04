package com.dokor.argos.services.analysis.modules.html;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Analyse "HTML" d'une URL.
 * <p>
 * Ce module analyse le contenu HTML récupéré par {@link com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer}
 * et transmis via l'{@link com.dokor.argos.services.analysis.model.AuditContext}.
 * Il ne refait pas de fetch HTTP - il exploite uniquement le body déjà disponible dans le contexte.
 * <p>
 * 👉 Dans l'immédiat, on expose une méthode analyzeHtml(...) utilisée par l'orchestrateur.
 * Et la méthode analyze(...) retourne un module "vide" + warning si l'orchestrateur n'a pas fourni le HTML.
 * <p>
 * Lorsqu'on passera à l'orchestrator, je te propose d'introduire un AuditContext (inputUrl, normalizedUrl, httpResult, html, headers...)
 * et de faire évoluer l'interface.
 */
@Singleton
public class HtmlModuleAnalyzer implements AuditModuleAnalyzer {

    // Regex simples (MVP). Pour plus robuste : jsoup plus tard.
    private static final Pattern TITLE_PATTERN = Pattern.compile("(?is)<title\\b[^>]*>(.*?)</title>");
    private static final Pattern META_DESC_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*name\\s*=\\s*['\"]description['\"][^>]*>");
    private static final Pattern META_ROBOTS_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*name\\s*=\\s*['\"]robots['\"][^>]*>");
    private static final Pattern CANONICAL_PATTERN = Pattern.compile("(?is)<link\\b[^>]*rel\\s*=\\s*['\"]canonical['\"][^>]*>");
    private static final Pattern H1_PATTERN = Pattern.compile("(?is)<h1\\b[^>]*>(.*?)</h1>");
    private static final Pattern LANG_PATTERN = Pattern.compile("(?is)<html\\b[^>]*lang\\s*=\\s*['\"]([^'\"]+)['\"][^>]*>");
    private static final Pattern VIEWPORT_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*name\\s*=\\s*['\"]viewport['\"][^>]*>");
    // Doctype HTML5 (déclenche le mode standards). Présent dans le HTML initial, y
    // compris pour une SPA → sûr sur les contenus dynamiques (issue #152).
    private static final Pattern DOCTYPE_HTML5_PATTERN = Pattern.compile("(?i)<!doctype\\s+html\\s*>");
    // Déclaration d'encodage : <meta charset=...> ou http-equiv Content-Type ...charset=.
    private static final Pattern CHARSET_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*charset\\s*=");
    private static final Pattern OG_TITLE_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*property\\s*=\\s*['\"]og:title['\"][^>]*>");
    private static final Pattern OG_DESC_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*property\\s*=\\s*['\"]og:description['\"][^>]*>");
    private static final Pattern OG_IMAGE_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*property\\s*=\\s*['\"]og:image['\"][^>]*>");
    private static final Pattern TW_CARD_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*name\\s*=\\s*['\"]twitter:card['\"][^>]*>");
    private static final Pattern SCRIPT_PATTERN = Pattern.compile("(?is)<script\\b[^>]*>");
    private static final Pattern IMG_PATTERN = Pattern.compile("(?is)<img\\b[^>]*>");
    private static final Pattern IMG_ALT_MISSING_PATTERN = Pattern.compile("(?is)<img\\b(?![^>]*\\balt\\s*=)[^>]*>");
    private static final Pattern A_PATTERN = Pattern.compile("(?is)<a\\b[^>]*>");
    private static final Pattern A_NO_HREF_PATTERN = Pattern.compile("(?is)<a\\b(?![^>]*\\bhref\\s*=)[^>]*>");

    @Override
    public String moduleId() {
        return "html";
    }

    /**
     * Méthode MVP pour analyser du HTML fourni par l'orchestrateur.
     */
    public AuditModuleResult analyzeHtml(String inputUrl, String normalizedUrl, String finalUrl, String html, Logger logger) {
        long start = System.currentTimeMillis();

        if (html == null || html.isBlank()) {
            logger.warn("HTML module: empty HTML input url={} normalizedUrl={}", inputUrl, normalizedUrl);
            return emptyHtmlModule(inputUrl, normalizedUrl, finalUrl, "Le HTML est vide ou absent.");
        }

        String title = firstGroup(TITLE_PATTERN, html);
        String lang = firstGroup(LANG_PATTERN, html);

        boolean hasMetaDesc = META_DESC_PATTERN.matcher(html).find();
        boolean hasRobots = META_ROBOTS_PATTERN.matcher(html).find();
        boolean hasCanonical = CANONICAL_PATTERN.matcher(html).find();
        boolean hasViewport = VIEWPORT_PATTERN.matcher(html).find();
        boolean hasDoctype = DOCTYPE_HTML5_PATTERN.matcher(html).find();
        boolean hasCharset = CHARSET_PATTERN.matcher(html).find();

        boolean hasOgTitle = OG_TITLE_PATTERN.matcher(html).find();
        boolean hasOgDesc = OG_DESC_PATTERN.matcher(html).find();
        boolean hasOgImage = OG_IMAGE_PATTERN.matcher(html).find();
        boolean hasTwitterCard = TW_CARD_PATTERN.matcher(html).find();

        int h1Count = countMatches(H1_PATTERN, html);
        String firstH1 = firstGroup(H1_PATTERN, html);

        int scriptCount = countMatches(SCRIPT_PATTERN, html);
        int imgCount = countMatches(IMG_PATTERN, html);
        int imgAltMissingCount = countMatches(IMG_ALT_MISSING_PATTERN, html);

        int aCount = countMatches(A_PATTERN, html);
        int aNoHrefCount = countMatches(A_NO_HREF_PATTERN, html);

        long durationMs = System.currentTimeMillis() - start;

        List<AuditCheckResult> checks = new ArrayList<>();

        // 1) Title
        checks.add(checkTitle(title));

        // 2) Meta description
        checks.add(checkMetaDescription(hasMetaDesc));

        // 3) Canonical
        checks.add(checkCanonical(hasCanonical));

        // 4) H1 presence and count
        checks.add(checkH1Count(h1Count, firstH1));

        // 5) <html lang="">
        checks.add(checkHtmlLang(lang));

        // 6) viewport (mobile)
        checks.add(checkViewport(hasViewport));

        // 6b) Doctype HTML5 (mode standards) — issue #152
        checks.add(checkDoctype(hasDoctype));

        // 6c) Déclaration d'encodage (charset) — issue #152
        checks.add(checkCharset(hasCharset));

        // 7) Robots meta (info)
        checks.add(AuditCheckResult.of(
            "html.meta.robots.present",
            "Présence de la balise meta robots",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            hasRobots,
            Map.of("present", hasRobots),
            hasRobots ? "Balise meta robots détectée." : "Aucune balise meta robots détectée.",
            null
        ));

        // 8) OpenGraph/Twitter tags (social sharing)
        checks.add(checkSocialTags(hasOgTitle, hasOgDesc, hasOgImage, hasTwitterCard));

        // 9) Images alt coverage
        checks.add(checkImagesAlt(imgCount, imgAltMissingCount));

        // 10) Anchors href coverage
        checks.add(checkAnchorsHref(aCount, aNoHrefCount));

        // 11) Script count (info)
        checks.add(AuditCheckResult.of(
            "html.scripts.count",
            "Nombre de balises script",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            scriptCount,
            Map.of("scriptCount", scriptCount),
            scriptCount + " balise(s) <script> détectée(s).",
            null
        ));

        // 12) HTML size (info)
        checks.add(AuditCheckResult.of(
            "html.size.bytes",
            "Taille du HTML (octets)",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            html.length(),
            Map.of("bytes", html.length()),
            "Taille du HTML : " + html.length() + " bytes.",
            null
        ));

        // 13) Analysis duration (info)
        checks.add(AuditCheckResult.of(
            "html.analysis.duration_ms",
            "Durée de l'analyse HTML",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            durationMs,
            Map.of("durationMs", durationMs),
            "Analyse HTML terminée en " + durationMs + " ms.",
            null
        ));

        String summary = buildSummary(title, h1Count, hasMetaDesc, hasCanonical, durationMs);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("inputUrl", inputUrl);
        data.put("normalizedUrl", normalizedUrl);
        data.put("finalUrl", finalUrl);
        data.put("title", title);
        data.put("lang", lang);
        data.put("h1Count", h1Count);
        data.put("firstH1", firstH1);
        data.put("hasMetaDescription", hasMetaDesc);
        data.put("hasCanonical", hasCanonical);
        data.put("hasViewport", hasViewport);
        data.put("hasOgTitle", hasOgTitle);
        data.put("hasOgDescription", hasOgDesc);
        data.put("hasOgImage", hasOgImage);
        data.put("hasTwitterCard", hasTwitterCard);
        data.put("scriptCount", scriptCount);
        data.put("imgCount", imgCount);
        data.put("imgAltMissingCount", imgAltMissingCount);
        data.put("anchorCount", aCount);
        data.put("anchorNoHrefCount", aNoHrefCount);
        data.put("durationMs", durationMs);

        logger.info(
            "HTML module done: titlePresent={} h1Count={} metaDesc={} canonical={} durationMs={}",
            title != null && !title.isBlank(),
            h1Count,
            hasMetaDesc,
            hasCanonical,
            durationMs
        );

        return new AuditModuleResult(
            moduleId(),
            "HTML",
            summary,
            data,
            checks
        );
    }

    /**
     * Implémentation AuditModuleAnalyzer : MVP.
     * Comme l'interface ne fournit pas encore l'HTML, on retourne un module "vide" avec un warning.
     * <p>
     * 👉 On corrigera ça dans l'orchestrator (en introduisant un AuditContext).
     */
    @Override
    public AuditModuleResult analyze(AuditContext context, Logger logger) {
        logger.debug("HTML module called");
        return analyzeHtml(context.inputUrl(), context.normalizedUrl(), context.finalUrl(), context.body(), logger);
    }

    // -------------------------
    // Checks builders
    // -------------------------

    private static AuditCheckResult checkTitle(String title) {
        boolean present = title != null && !title.isBlank();
        int len = present ? title.trim().length() : 0;

        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (!present) {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "Balise <title> absente.";
            recommendation = "Ajoutez une balise <title> descriptive pour le SEO et l'utilisabilité.";
        } else if (len < 10) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Le titre est présent mais très court (" + len + " chars).";
            recommendation = "Utilisez un titre plus descriptif (idéalement 30 à 60 caractères).";
        } else if (len > 80) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Le titre est long (" + len + " chars).";
            recommendation = "Raccourcissez le titre (idéalement 30 à 60 caractères).";
        } else {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Le titre est présent (" + len + " chars).";
        }

        return AuditCheckResult.of(
            "html.title",
            "Page title",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            title,
            Map.of("length", len),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkMetaDescription(boolean present) {
        return AuditCheckResult.of(
            "html.meta.description.present",
            "Présence de la meta description",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "La meta description est présente." : "La meta description est absente.",
            present ? null : "Ajoutez une meta description pour améliorer l'aperçu dans les résultats de recherche."
        );
    }

    private static AuditCheckResult checkCanonical(boolean present) {
        return AuditCheckResult.of(
            "html.link.canonical.present",
            "Présence du lien canonical",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "Le lien canonical est présent." : "Le lien canonical est absent.",
            present ? null : "Ajoutez un lien canonical pour limiter le contenu dupliqué."
        );
    }

    private static AuditCheckResult checkH1Count(int h1Count, String firstH1) {
        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        switch (h1Count) {
            case 0 -> {
                status = AuditStatus.WARN;
                severity = AuditSeverity.MEDIUM;
                message = "Aucun <h1> trouvé.";
                recommendation = "Ajoutez un H1 décrivant le sujet principal de la page.";
            }
            case 1 -> {
                status = AuditStatus.PASS;
                severity = AuditSeverity.LOW;
                message = "Exactly one <h1> found.";
            }
            default -> {
                status = AuditStatus.WARN;
                severity = AuditSeverity.LOW;
                message = "Multiple <h1> found (" + h1Count + ").";
                recommendation = "Privilégiez un seul H1 pour la clarté (sauf si la structure de la page l'impose).";
            }
        }

        return AuditCheckResult.of(
            "html.h1.count",
            "Nombre de titres H1",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            firstH1 != null ? Map.of("count", h1Count, "firstH1", firstH1) : Map.of(),
            Map.of("h1Count", h1Count),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkHtmlLang(String lang) {
        boolean present = lang != null && !lang.isBlank();

        return AuditCheckResult.of(
            "html.lang",
            "Attribut lang du HTML",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            lang,
            present ? Map.of("lang", lang) : Map.of(),
            present ? "L'attribut lang est défini (" + lang + ")." : "Attribut lang absent sur le <html>.",
            present ? null : "Set <html lang=\"...\"> for accessibility and SEO."
        );
    }

    private static AuditCheckResult checkViewport(boolean present) {
        return AuditCheckResult.of(
            "html.meta.viewport.present",
            "Présence de la balise meta viewport",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "La balise meta viewport est présente." : "La balise meta viewport est absente.",
            present ? null : "Ajoutez <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> pour l'affichage mobile."
        );
    }

    private static AuditCheckResult checkDoctype(boolean present) {
        return AuditCheckResult.of(
            "html.doctype.html5",
            "Doctype HTML5",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "Le doctype HTML5 est déclaré (mode standards)." : "Aucun doctype HTML5 déclaré.",
            present ? null : "Ajoutez <!doctype html> en tête de page : sans lui, le navigateur passe en mode quirks et le rendu peut être imprévisible."
        );
    }

    private static AuditCheckResult checkCharset(boolean present) {
        return AuditCheckResult.of(
            "html.meta.charset.present",
            "Déclaration d'encodage (charset)",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "L'encodage est déclaré." : "Aucune déclaration d'encodage détectée.",
            present ? null : "Déclarez l'encodage tôt dans le <head> : <meta charset=\"utf-8\"> pour éviter les problèmes d'affichage des caractères."
        );
    }

    private static AuditCheckResult checkSocialTags(boolean ogTitle, boolean ogDesc, boolean ogImage, boolean twitterCard) {
        int presentCount = 0;
        if (ogTitle) presentCount++;
        if (ogDesc) presentCount++;
        if (ogImage) presentCount++;
        if (twitterCard) presentCount++;

        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (presentCount >= 3) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Les balises meta sociales sont globalement présentes.";
        } else if (presentCount >= 1) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Certaines balises meta sociales sont absentes.";
            recommendation = "Ajoutez les balises OpenGraph (og:title, og:description, og:image) et Twitter card.";
        } else {
            status = AuditStatus.INFO;
            severity = AuditSeverity.LOW;
            message = "Aucune balise meta sociale détectée.";
            recommendation = "Ajoutez des balises OpenGraph/Twitter pour améliorer les aperçus de partage sur les réseaux sociaux.";
        }

        return AuditCheckResult.of(
            "html.social.meta",
            "Balises meta sociales (OpenGraph/Twitter)",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            Map.of(
                "ogTitle", ogTitle,
                "ogDescription", ogDesc,
                "ogImage", ogImage,
                "twitterCard", twitterCard
            ),
            Map.of(
                "og:title", ogTitle,
                "og:description", ogDesc,
                "og:image", ogImage,
                "twitter:card", twitterCard
            ),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkImagesAlt(int imgCount, int imgAltMissingCount) {
        if (imgCount == 0) {
            return AuditCheckResult.of(
                "html.images.alt_coverage",
                "Couverture des attributs alt (images)",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,          // scorable filled later
                0.0,            // weight filled later
                List.of(),      // tags filled later
                Map.of("imgCount", 0, "missingAltCount", 0),
                Map.of("imgCount", 0),
                "Aucune image détectée.",
                null
            );
        }

        double missingRatio = (double) imgAltMissingCount / (double) imgCount;
        int missingPct = (int) Math.round(missingRatio * 100.0);

        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (imgAltMissingCount == 0) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Toutes les images ont un attribut alt.";
        } else if (missingPct <= 20) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Certaines images n'ont pas d'attribut alt (" + missingPct + "%).";
            recommendation = "Ajoutez des attributs alt pour l'accessibilité et le SEO.";
        } else {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "De nombreuses images n'ont pas d'attribut alt (" + missingPct + "%).";
            recommendation = "Ajoutez des attributs alt pertinents pour améliorer l'accessibilité.";
        }

        return AuditCheckResult.of(
            "html.images.alt_coverage",
            "Couverture des attributs alt (images)",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            Map.of("imgCount", imgCount, "missingAltCount", imgAltMissingCount, "missingPct", missingPct),
            Map.of("imgCount", imgCount, "imgAltMissingCount", imgAltMissingCount),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkAnchorsHref(int anchorCount, int noHrefCount) {
        if (anchorCount == 0) {
            return AuditCheckResult.of(
                "html.anchors.href_coverage",
                "Couverture des liens (href)",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,          // scorable filled later
                0.0,            // weight filled later
                List.of(),      // tags filled later
                Map.of("anchorCount", 0, "noHrefCount", 0),
                Map.of("anchorCount", 0),
                "Aucun lien détecté.",
                null
            );
        }

        double missingRatio = (double) noHrefCount / (double) anchorCount;
        int missingPct = (int) Math.round(missingRatio * 100.0);

        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (noHrefCount == 0) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Tous les liens ont un attribut href.";
        } else if (missingPct <= 10) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Certains liens n'ont pas d'attribut href (" + missingPct + "%).";
            recommendation = "Assurez-vous que les balises <a> sont des liens valides, ou utilisez des boutons pour les actions.";
        } else {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "De nombreux liens n'ont pas d'attribut href (" + missingPct + "%).";
            recommendation = "Replace non-link anchors with <button> or add proper href attributes.";
        }

        return AuditCheckResult.of(
            "html.anchors.href_coverage",
            "Couverture des liens (href)",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            Map.of("anchorCount", anchorCount, "noHrefCount", noHrefCount, "missingPct", missingPct),
            Map.of("anchorCount", anchorCount, "noHrefCount", noHrefCount),
            message,
            recommendation
        );
    }

    // -------------------------
    // Helpers
    // -------------------------

    private static AuditModuleResult emptyHtmlModule(String inputUrl, String normalizedUrl, String finalUrl, String reason) {
        return new AuditModuleResult(
            "html",
            "HTML",
            "Analyse HTML indisponible : " + reason,
            Map.of(
                "inputUrl", inputUrl,
                "normalizedUrl", normalizedUrl,
                "finalUrl", finalUrl != null ? finalUrl : "unknown",
                "reason", reason
            ),
            List.of(
                AuditCheckResult.of(
                    "html.available",
                    "Disponibilité du HTML",
                    AuditStatus.WARN,
                    AuditSeverity.MEDIUM,
                    false,          // scorable filled later
                    0.0,            // weight filled later
                    List.of(),      // tags filled later
                    false,
                    Map.of("reason", reason),
                    "L'analyse HTML n'a pas pu s'exécuter.",
                    "Vérifiez que l'orchestrateur fournit le contenu HTML (fetch ou réutilisation du body du module HTTP)."
                )
            )
        );
    }

    private static String firstGroup(Pattern pattern, String html) {
        Matcher m = pattern.matcher(html);
        if (!m.find()) return null;
        String value = m.group(1);
        return value != null ? stripTags(value).trim() : null;
    }

    private static int countMatches(Pattern pattern, String html) {
        int count = 0;
        Matcher m = pattern.matcher(html);
        while (m.find()) count++;
        return count;
    }

    /**
     * MVP: retire grossièrement les tags éventuels.
     * Si tu veux plus précis, on passera sur jsoup.
     */
    private static String stripTags(String s) {
        if (s == null) return null;
        return s.replaceAll("(?is)<[^>]+>", " ");
    }

    private static String buildSummary(String title, int h1Count, boolean metaDesc, boolean canonical, long durationMs) {
        return "titlePresent=" + (title != null && !title.isBlank())
            + ", h1Count=" + h1Count
            + ", metaDesc=" + metaDesc
            + ", canonical=" + canonical
            + ", durationMs=" + durationMs;
    }
}
