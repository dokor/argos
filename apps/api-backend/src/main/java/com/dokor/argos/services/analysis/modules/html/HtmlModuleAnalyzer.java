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
 * Ce module se base sur le HTML déjà récupéré côté HTTP (dans l'état actuel de ton code, tu as un HtmlExtractor).
 * Ici, on reste MVP : on ne refait pas un fetch HTTP, on analyse juste un contenu HTML.
 * <p>
 * ⚠️ Pour l'instant, l'interface AuditModuleAnalyzer ne fournit pas le body HTML.
 * Donc ce HtmlModuleAnalyzer est conçu pour être appelé par l'orchestrateur avec une "source" HTML
 * (ex: via un wrapper ou en passant un "context" plus tard).
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
            return emptyHtmlModule(inputUrl, normalizedUrl, finalUrl, "HTML is empty or null");
        }

        String title = firstGroup(TITLE_PATTERN, html);
        String lang = firstGroup(LANG_PATTERN, html);

        boolean hasMetaDesc = META_DESC_PATTERN.matcher(html).find();
        boolean hasRobots = META_ROBOTS_PATTERN.matcher(html).find();
        boolean hasCanonical = CANONICAL_PATTERN.matcher(html).find();
        boolean hasViewport = VIEWPORT_PATTERN.matcher(html).find();

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

        // 7) Robots meta (info)
        checks.add(new AuditCheckResult(
            "html.meta.robots.present",
            "Meta robots present",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            hasRobots,
            Map.of("present", hasRobots),
            hasRobots ? "Meta robots tag detected." : "No meta robots tag detected.",
            null
        ));

        // 8) OpenGraph/Twitter tags (social sharing)
        checks.add(checkSocialTags(hasOgTitle, hasOgDesc, hasOgImage, hasTwitterCard));

        // 9) Images alt coverage
        checks.add(checkImagesAlt(imgCount, imgAltMissingCount));

        // 10) Anchors href coverage
        checks.add(checkAnchorsHref(aCount, aNoHrefCount));

        // 11) Script count (info)
        checks.add(new AuditCheckResult(
            "html.scripts.count",
            "Script tags count",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            scriptCount,
            Map.of("scriptCount", scriptCount),
            "Found " + scriptCount + " <script> tags.",
            null
        ));

        // 12) HTML size (info)
        checks.add(new AuditCheckResult(
            "html.size.bytes",
            "HTML size (bytes)",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            html.length(),
            Map.of("bytes", html.length()),
            "HTML size is " + html.length() + " bytes.",
            null
        ));

        // 13) Analysis duration (info)
        checks.add(new AuditCheckResult(
            "html.analysis.duration_ms",
            "HTML analysis duration",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            durationMs,
            Map.of("durationMs", durationMs),
            "HTML analysis completed in " + durationMs + " ms.",
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
            message = "Missing <title> tag.";
            recommendation = "Add a meaningful <title> for SEO and usability.";
        } else if (len < 10) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Title is present but very short (" + len + " chars).";
            recommendation = "Use a more descriptive title (often 30-60 chars is a good target).";
        } else if (len > 80) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Title is long (" + len + " chars).";
            recommendation = "Consider shortening the title (often 30-60 chars is a good target).";
        } else {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Title is present (" + len + " chars).";
        }

        return new AuditCheckResult(
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
        return new AuditCheckResult(
            "html.meta.description.present",
            "Meta description present",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "Meta description is present." : "Meta description is missing.",
            present ? null : "Add a meta description to improve search snippets."
        );
    }

    private static AuditCheckResult checkCanonical(boolean present) {
        return new AuditCheckResult(
            "html.link.canonical.present",
            "Canonical link present",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "Canonical link is present." : "Canonical link is missing.",
            present ? null : "Add a canonical link to reduce duplicate content issues."
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
                message = "No <h1> found.";
                recommendation = "Add one H1 to describe the main topic of the page.";
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
                recommendation = "Prefer a single H1 for clarity (unless your page structure requires otherwise).";
            }
        }

        return new AuditCheckResult(
            "html.h1.count",
            "H1 heading count",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            Map.of("count", h1Count, "firstH1", firstH1),
            Map.of("h1Count", h1Count),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkHtmlLang(String lang) {
        boolean present = lang != null && !lang.isBlank();

        return new AuditCheckResult(
            "html.lang",
            "HTML lang attribute",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            lang,
            present ? Map.of("lang", lang) : Map.of(),
            present ? "HTML lang is set (" + lang + ")." : "Missing lang attribute on <html>.",
            present ? null : "Set <html lang=\"...\"> for accessibility and SEO."
        );
    }

    private static AuditCheckResult checkViewport(boolean present) {
        return new AuditCheckResult(
            "html.meta.viewport.present",
            "Viewport meta present",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present),
            present ? "Viewport meta is present." : "Viewport meta is missing.",
            present ? null : "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> for mobile friendliness."
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
            message = "Social meta tags are mostly present.";
        } else if (presentCount >= 1) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Some social meta tags are missing.";
            recommendation = "Consider adding OpenGraph (og:title, og:description, og:image) and Twitter card tags.";
        } else {
            status = AuditStatus.INFO;
            severity = AuditSeverity.LOW;
            message = "No social meta tags detected.";
            recommendation = "Add OpenGraph/Twitter tags to improve link previews on social platforms.";
        }

        return new AuditCheckResult(
            "html.social.meta",
            "Social meta tags (OpenGraph/Twitter)",
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
            return new AuditCheckResult(
                "html.images.alt_coverage",
                "Image alt coverage",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,          // scorable filled later
                0.0,            // weight filled later
                List.of(),      // tags filled later
                Map.of("imgCount", 0, "missingAltCount", 0),
                Map.of("imgCount", 0),
                "No images detected.",
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
            message = "All images have an alt attribute.";
        } else if (missingPct <= 20) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Some images are missing alt attributes (" + missingPct + "%).";
            recommendation = "Add alt attributes for accessibility and SEO.";
        } else {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Many images are missing alt attributes (" + missingPct + "%).";
            recommendation = "Add meaningful alt attributes to improve accessibility.";
        }

        return new AuditCheckResult(
            "html.images.alt_coverage",
            "Image alt coverage",
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
            return new AuditCheckResult(
                "html.anchors.href_coverage",
                "Anchor href coverage",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,          // scorable filled later
                0.0,            // weight filled later
                List.of(),      // tags filled later
                Map.of("anchorCount", 0, "noHrefCount", 0),
                Map.of("anchorCount", 0),
                "No anchors detected.",
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
            message = "All anchors have an href attribute.";
        } else if (missingPct <= 10) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.LOW;
            message = "Some anchors are missing href (" + missingPct + "%).";
            recommendation = "Ensure <a> tags are valid links or use buttons for actions.";
        } else {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Many anchors are missing href (" + missingPct + "%).";
            recommendation = "Replace non-link anchors with <button> or add proper href attributes.";
        }

        return new AuditCheckResult(
            "html.anchors.href_coverage",
            "Anchor href coverage",
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
            "HTML analysis not available: " + reason,
            Map.of(
                "inputUrl", inputUrl,
                "normalizedUrl", normalizedUrl,
                "finalUrl", finalUrl != null ? finalUrl : "unknown",
                "reason", reason
            ),
            List.of(
                new AuditCheckResult(
                    "html.available",
                    "HTML available",
                    AuditStatus.WARN,
                    AuditSeverity.MEDIUM,
                    false,          // scorable filled later
                    0.0,            // weight filled later
                    List.of(),      // tags filled later
                    false,
                    Map.of("reason", reason),
                    "HTML analysis could not run.",
                    "Ensure the orchestrator provides HTML content (fetch or reuse HTTP module body)."
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
