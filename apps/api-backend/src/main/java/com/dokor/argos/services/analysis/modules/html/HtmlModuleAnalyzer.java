package com.dokor.argos.services.analysis.modules.html;

import com.dokor.argos.services.analysis.AuditModule;
import com.dokor.argos.services.analysis.ModuleUnavailableException;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.DocumentType;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.net.URI;
import java.util.*;
import java.util.function.Predicate;

/**
 * Analyse "HTML" d'une URL.
 * <p>
 * Ce module analyse le contenu HTML récupéré par {@link com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer}
 * et transmis via l'{@link com.dokor.argos.services.analysis.model.AuditContext}.
 * Il ne refait pas de fetch HTTP - il exploite uniquement le body déjà disponible dans le contexte.
 * <p>
 * Le contexte enrichi par HTTP apporte le HTML à analyze(...).
 */
@Singleton
public class HtmlModuleAnalyzer {

    public String moduleId() {
        return AuditModule.HTML.id();
    }

    /**
     * Analyse structurelle du HTML fourni par l'orchestrateur.
     */
    public AuditModuleResult analyzeHtml(String inputUrl, String normalizedUrl, String finalUrl, String html, Logger logger) {
        long start = System.currentTimeMillis();

        if (html == null || html.isBlank()) {
            logger.warn("HTML module: empty HTML input url={} normalizedUrl={}", UrlNormalizer.sanitizeForLog(inputUrl), UrlNormalizer.sanitizeForLog(normalizedUrl));
            throw new ModuleUnavailableException("Le HTML est vide ou absent.");
        }

        // Parse the supplied snapshot only: no network fetch and no script execution.
        Document document = Jsoup.parse(html, finalUrl != null ? finalUrl : normalizedUrl);
        String title = textOf(document.selectFirst("title"));
        Element root = document.selectFirst("html");
        String lang = root != null && root.hasAttr("lang") ? clean(root.attr("lang")) : null;

        AttributeObservation description = observe(namedMeta(document, "name", "description"), "content", value -> true);
        AttributeObservation canonical = observe(document.select("link").stream()
            .filter(e -> Arrays.stream(e.attr("rel").split("\\s+")).anyMatch("canonical"::equalsIgnoreCase)).toList(),
            "href", HtmlModuleAnalyzer::usableHttpUrl);
        AttributeObservation viewport = observe(namedMeta(document, "name", "viewport"), "content", HtmlModuleAnalyzer::usableViewport);
        boolean hasMetaDesc = description.usable();
        boolean hasCanonical = canonical.usable();
        boolean hasViewport = viewport.usable();
        boolean hasRobots = !namedMeta(document, "name", "robots").isEmpty();
        boolean hasDoctype = document.childNodes().stream().filter(DocumentType.class::isInstance)
            .map(DocumentType.class::cast).anyMatch(d -> "html".equalsIgnoreCase(d.name())
                && d.publicId().isBlank() && d.systemId().isBlank());
        boolean hasCharset = document.select("meta").stream().anyMatch(e ->
            (e.hasAttr("charset") && !clean(e.attr("charset")).isBlank())
                || ("content-type".equalsIgnoreCase(e.attr("http-equiv"))
                    && Arrays.stream(e.attr("content").split(";")).anyMatch(HtmlModuleAnalyzer::charsetParameter)));

        boolean hasOgTitle = usableMeta(document, "property", "og:title");
        boolean hasOgDesc = usableMeta(document, "property", "og:description");
        boolean hasOgImage = usableMeta(document, "property", "og:image");
        boolean hasTwitterCard = usableMeta(document, "name", "twitter:card");

        Elements headings = document.select("h1");
        int h1Count = headings.size();
        String firstH1 = textOf(headings.first());
        int scriptCount = document.select("script").size();
        Elements images = document.select("img");
        int imgCount = images.size();
        // Empty alt is intentional for decorative images; data-alt is a separate attribute.
        int imgAltMissingCount = (int) images.stream().filter(e -> !e.hasAttr("alt")).count();
        Elements anchors = document.select("a");
        int aCount = anchors.size();
        int aNoHrefCount = (int) anchors.stream().filter(e -> !e.hasAttr("href")).count();

        long durationMs = System.currentTimeMillis() - start;

        List<AuditCheckResult> checks = new ArrayList<>();

        // 1) Title
        checks.add(checkTitle(title));

        // 2) Meta description
        checks.add(checkMetaDescription(description));

        // 3) Canonical
        checks.add(checkCanonical(canonical));

        // 4) H1 presence and count
        checks.add(checkH1Count(h1Count, firstH1));

        // 5) <html lang="">
        checks.add(checkHtmlLang(lang));

        // 6) viewport (mobile)
        checks.add(checkViewport(viewport));

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
        data.put("description", description.details());
        data.put("canonical", canonical.details());
        data.put("viewport", viewport.details());
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
     * Analyse le HTML du contexte.
     */
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

    private static AuditCheckResult checkMetaDescription(AttributeObservation observation) {
        boolean present = observation.usable();
        return AuditCheckResult.of(
            "html.meta.description.present",
            "Présence de la meta description",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            observation.details(),
            present ? "La meta description est présente." : "La meta description est absente ou son contenu est vide.",
            present ? null : "Ajoutez une meta description pour améliorer l'aperçu dans les résultats de recherche."
        );
    }

    private static AuditCheckResult checkCanonical(AttributeObservation observation) {
        boolean present = observation.usable();
        return AuditCheckResult.of(
            "html.link.canonical.present",
            "Présence du lien canonical",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            observation.details(),
            present ? "Le lien canonical est présent." : "Le lien canonical est absent, vide ou invalide.",
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

    private static AuditCheckResult checkViewport(AttributeObservation observation) {
        boolean present = observation.usable();
        return AuditCheckResult.of(
            "html.meta.viewport.present",
            "Présence de la balise meta viewport",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            observation.details(),
            present ? "La balise meta viewport est présente." : "La balise meta viewport est absente, vide ou inexploitable.",
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

    private record AttributeObservation(boolean elementPresent, boolean attributePresent, String value, boolean usable) {
        Map<String, Object> details() {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("present", usable);
            details.put("elementPresent", elementPresent);
            details.put("attributePresent", attributePresent);
            details.put("value", value);
            details.put("usable", usable);
            details.put("state", !elementPresent ? "ABSENT" : !attributePresent ? "ATTRIBUTE_MISSING"
                : value.isBlank() ? "EMPTY" : usable ? "USABLE" : "INVALID");
            return details;
        }
    }

    private static AttributeObservation observe(List<Element> elements, String attribute, Predicate<String> validator) {
        AttributeObservation first = new AttributeObservation(false, false, null, false);
        for (Element element : elements) {
            boolean present = element.hasAttr(attribute);
            String value = present ? clean(element.attr(attribute)) : null;
            String validationValue = "href".equals(attribute) ? element.absUrl(attribute) : value;
            boolean usable = present && !value.isBlank() && validator.test(validationValue);
            var observation = new AttributeObservation(true, present, value, usable);
            if (usable) return observation;
            if (!first.elementPresent()) first = observation;
        }
        return first;
    }

    private static List<Element> namedMeta(Document document, String attribute, String value) {
        return document.select("meta").stream().filter(e -> value.equalsIgnoreCase(clean(e.attr(attribute)))).toList();
    }

    private static boolean usableMeta(Document document, String attribute, String value) {
        return observe(namedMeta(document, attribute, value), "content", ignored -> true).usable();
    }

    private static String clean(String value) { return value.replace('\u00a0', ' ').strip(); }
    private static String textOf(Element element) { return element == null ? null : element.text(); }

    private static boolean charsetParameter(String value) {
        String[] parameter = value.split("=", 2);
        return parameter.length == 2 && "charset".equalsIgnoreCase(parameter[0].trim())
            && !parameter[1].replace("\"", "").replace("'", "").isBlank();
    }

    private static boolean usableHttpUrl(String value) {
        try {
            URI uri = URI.create(value);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException invalid) { return false; }
    }

    private static boolean usableViewport(String value) {
        for (String directive : value.split("[,;]")) {
            String[] pair = directive.trim().toLowerCase(Locale.ROOT).split("=", 2);
            if (pair.length != 2) continue;
            String key = pair[0].trim(), setting = pair[1].trim();
            if (("width".equals(key) && "device-width".equals(setting))
                || ("height".equals(key) && "device-height".equals(setting))) return true;
            if (Set.of("width", "height", "initial-scale", "minimum-scale", "maximum-scale").contains(key)) {
                try { double number = Double.parseDouble(setting); if (Double.isFinite(number) && number > 0) return true; }
                catch (NumberFormatException ignored) { }
            }
        }
        return false;
    }

    private static String buildSummary(String title, int h1Count, boolean metaDesc, boolean canonical, long durationMs) {
        return "titlePresent=" + (title != null && !title.isBlank())
            + ", h1Count=" + h1Count
            + ", metaDesc=" + metaDesc
            + ", canonical=" + canonical
            + ", durationMs=" + durationMs;
    }
}
