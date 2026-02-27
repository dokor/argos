package com.dokor.argos.services.analysis.modules.tech;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Analyse "TECH" d'une URL.
 * <p>
 * MVP :
 * - détection heuristique (sans JS, sans headless browser)
 * - se base sur signaux HTML + headers HTTP disponibles (si l'orchestrateur les fournit)
 * <p>
 * ⚠️ Comme pour HtmlModuleAnalyzer, l'interface AuditModuleAnalyzer ne fournit pas encore
 * de "context" (headers/html). Donc :
 * - la méthode analyze(...) retourne un module "warning" par défaut
 * - l'orchestrateur doit appeler analyzeTech(...) en lui passant headers+html
 * <p>
 * Plus tard :
 * - intégrer Playwright (JS rendu) pour une détection plus fiable (Next/React/Angular etc.)
 * - enrichir la détection via signatures (Wappalyzer-like) ou empreintes (hash, bundles, meta generator...)
 */
@Singleton
public class TechModuleAnalyzer implements AuditModuleAnalyzer {

    // Signatures simples (HTML)
    private static final Pattern WP_CONTENT_PATTERN = Pattern.compile("(?is)wp-content|wp-includes|/wp-json/");
    private static final Pattern WP_GENERATOR_PATTERN = Pattern.compile("(?is)<meta\\b[^>]*name\\s*=\\s*['\"]generator['\"][^>]*content\\s*=\\s*['\"][^'\"]*wordpress[^'\"]*['\"][^>]*>");
    private static final Pattern SHOPIFY_PATTERN = Pattern.compile("(?is)cdn\\.shopify\\.com|Shopify\\.theme|x-shopify|shopify-section|/cart\\.js");
    private static final Pattern WIX_PATTERN = Pattern.compile("(?is)wix\\.com|_wix|X-Wix|wix-bolt|wixRenderer");
    private static final Pattern SQUARESPACE_PATTERN = Pattern.compile("(?is)squarespace\\.com|static\\.squarespace\\.com|Squarespace");
    private static final Pattern WEBFLOW_PATTERN = Pattern.compile("(?is)webflow\\.com|webflow\\.js|data-wf-page|data-wf-site");
    private static final Pattern GHOST_PATTERN = Pattern.compile("(?is)ghost\\.io|/ghost/|data-ghost|<meta\\b[^>]*name=['\"]generator['\"][^>]*ghost");
    private static final Pattern DRUPAL_PATTERN = Pattern.compile("(?is)drupal-settings-json|/sites/default/|Drupal\\.settings");
    private static final Pattern JOOMLA_PATTERN = Pattern.compile("(?is)Joomla!|/media/system/js/|/templates/");

    // Frameworks / runtime
    private static final Pattern NEXT_PATTERN = Pattern.compile("(?is)__NEXT_DATA__|/_next/|next\\.js");
    private static final Pattern NUXT_PATTERN = Pattern.compile("(?is)__NUXT__|/_nuxt/");
    private static final Pattern GATSBY_PATTERN = Pattern.compile("(?is)gatsby|___gatsby|/page-data/");
    private static final Pattern REACT_PATTERN = Pattern.compile("(?is)data-reactroot|react-dom|__REACT_DEVTOOLS_GLOBAL_HOOK__");
    private static final Pattern VUE_PATTERN = Pattern.compile("(?is)__VUE__|data-v-|vue\\.runtime|Vue\\.config");
    private static final Pattern ANGULAR_PATTERN = Pattern.compile("(?is)ng-version|_ngcontent-|angular\\.js|Angular");
    private static final Pattern SVELTE_PATTERN = Pattern.compile("(?is)svelte|data-svelte|__SVELTE");

    // Backend hints (headers)
    private static final Pattern PHP_HINT_PATTERN = Pattern.compile("(?is)php|phpsessid|x-powered-by:.*php");
    private static final Pattern ASPNET_HINT_PATTERN = Pattern.compile("(?is)asp\\.net|\\.aspx|x-aspnet|x-powered-by:.*asp");
    private static final Pattern JAVA_HINT_PATTERN = Pattern.compile("(?is)jsp|jsessionid|x-powered-by:.*servlet|jetty|tomcat");
    private static final Pattern NODE_HINT_PATTERN = Pattern.compile("(?is)node|express");
    private static final Pattern NGINX_HINT_PATTERN = Pattern.compile("(?is)nginx");
    private static final Pattern APACHE_HINT_PATTERN = Pattern.compile("(?is)apache");
    private static final Pattern CLOUDFLARE_HINT_PATTERN = Pattern.compile("(?is)cloudflare|cf-ray|cf-cache-status");

    @Override
    public String moduleId() {
        return "tech";
    }

    private final NextJsDetectorService nextDetector;

    public TechModuleAnalyzer(NextJsDetectorService nextDetector) {
        this.nextDetector = nextDetector;
    }

    /**
     * Analyse TECH à partir des informations collectées par les autres modules.
     *
     * @param inputUrl      url d'entrée
     * @param normalizedUrl url normalisée
     * @param finalUrl      url finale après redirects
     * @param headers       headers HTTP "flatten" (lowercase keys) - typiquement httpModule.data().get("headers")
     * @param html          html de la réponse finale (si dispo)
     */
    public AuditModuleResult analyzeTech(
        String inputUrl,
        String normalizedUrl,
        String finalUrl,
        Map<String, String> headers,
        String html,
        Logger logger
    ) {
        long start = System.currentTimeMillis();

        headers = headers != null ? headers : Map.of();
        String serverHeader = headers.get("server");
        String poweredBy = headers.get("x-powered-by");
        String setCookie = headers.get("set-cookie");

        // Détections "CMS"
        DetectedTech cms = detectCms(headers, html);

        // Détections "framework front"
        DetectedTech frontend = detectFrontendFramework(headers, html);

        // Détections spécifique a Next
        var next = nextDetector.detect(headers, html);

        // Détections "backend / runtime"
        List<String> backendHints = detectBackendHints(headers, poweredBy, setCookie, serverHeader, html);

        // CDN / proxy
        boolean cloudflare = matchesAny(CLOUDFLARE_HINT_PATTERN, concat(headers));

        long durationMs = System.currentTimeMillis() - start;

        List<AuditCheckResult> checks = new ArrayList<>();

        Map<String, Object> mapCms = new HashMap<>(Map.of("confidence", cms.confidence));
        if (cms.name != null) {
            mapCms.put("name", cms.name);
        }

        // 1) CMS
        checks.add(new AuditCheckResult(
            "tech.cms",
            "CMS detection",
            cms.confidence >= 0.7 ? AuditStatus.PASS : AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            mapCms,
            Map.of("signals", cms.signals),
            cms.name != null ? ("Detected CMS: " + cms.name) : "No CMS detected (heuristic).",
            null
        ));

        // 2) Frontend framework
        checks.add(new AuditCheckResult(
            "tech.frontend.framework",
            "Frontend framework detection",
            frontend.confidence >= 0.7 ? AuditStatus.PASS : AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            Map.of("name", frontend.name, "confidence", frontend.confidence),
            Map.of("signals", frontend.signals),
            !frontend.name.equals("unknown") ? "Detected frontend framework: " + frontend.name : "No frontend framework detected (heuristic).",
            null
        ));

        Map<String, Object> nextData = new LinkedHashMap<>();
        nextData.put("isNext", next.isNext());
        nextData.put("confidence", next.confidence());
        nextData.put("router", next.router());
        if (next.buildId() != null) nextData.put("buildId", next.buildId());

        Map<String, Object> nextVersion = new LinkedHashMap<>();
        nextVersion.put("exact", next.version().exact());
        nextVersion.put("min", next.version().min());
        nextVersion.put("max", next.version().max());
        nextVersion.put("guess", next.version().guess());
        nextVersion.put("guessConfidence", next.version().guessConfidence());
        nextVersion.put("method", next.version().method());
        nextData.put("version", nextVersion);

        checks.add(new AuditCheckResult(
            "tech.frontend.nextjs",
            "Next.js detection & version (best-effort)",
            next.isNext() ? AuditStatus.PASS : AuditStatus.INFO,
            AuditSeverity.LOW,
            false,
            0.0,
            List.of(),
            nextData,
            Map.of("evidence", next.evidence()),
            next.isNext()
                ? ("Next.js detected (router=" + next.router() + "). Version guess: " + safe(next.version().guess()))
                : "Next.js not detected.",
            next.isNext() && next.version().exact() == null
                ? "Exact Next.js version is rarely exposed in production. This is a best-effort guess based on public signals."
                : null
        ));

        Map<String, Object> objectMap = new HashMap<>(Map.of());
        if (serverHeader != null) {
            objectMap.put("server", serverHeader);
        }
        if (poweredBy != null) {
            objectMap.put("x-powered-by", poweredBy);
        }
        if (setCookie != null) {
            objectMap.put("set-cookie", setCookie);
        }

        // 3) Backend hints (info)
        checks.add(new AuditCheckResult(
            "tech.backend.hints",
            "Backend hints (headers/cookies)",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            backendHints,
            objectMap,
            backendHints.isEmpty() ? "No strong backend hint detected." : "Backend hints detected: " + String.join(", ", backendHints),
            null
        ));

        // 4) CDN/Proxy
        checks.add(new AuditCheckResult(
            "tech.cdn.cloudflare",
            "Cloudflare detected",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            cloudflare,
            Map.of("signals", cloudflare ? List.of("cf-ray/cf-cache-status/server=cloudflare") : List.of()),
            cloudflare ? "Cloudflare appears to be in front of the site." : "No Cloudflare signal detected.",
            null
        ));

        // 5) Server header (info)
        checks.add(new AuditCheckResult(
            "tech.http.server_header",
            "Server header (raw)",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            serverHeader,
            serverHeader != null ? Map.of("server", serverHeader) : Map.of(),
            serverHeader != null ? "Server header is present." : "Server header not present.",
            null
        ));

        // 6) Orchestrator coverage (warn if missing html)
        if (html == null || html.isBlank()) {
            checks.add(new AuditCheckResult(
                "tech.html.available",
                "HTML available for tech detection",
                AuditStatus.WARN,
                AuditSeverity.MEDIUM,
                false,          // scorable filled later
                0.0,            // weight filled later
                List.of(),      // tags filled later
                false,
                Map.of("reason", "html not provided"),
                "HTML not provided: tech detection is limited to HTTP headers.",
                "Ensure the orchestrator passes HTML content from the HTTP module to improve detection accuracy."
            ));
        }

        // 7) Duration (info)
        checks.add(new AuditCheckResult(
            "tech.analysis.duration_ms",
            "Tech analysis duration",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            durationMs,
            Map.of("durationMs", durationMs),
            "Tech analysis completed in " + durationMs + " ms.",
            null
        ));

        String summary = "cms=" + safe(cms.name)
            + " frontend=" + safe(frontend.name)
            + " cloudflare=" + cloudflare
            + " durationMs=" + durationMs;

        Map<String, Object> data = new LinkedHashMap<>();
        Map<String, Object> cmsMap = new LinkedHashMap<>();
        if (cms.name != null) {
            cmsMap.put("name", cms.name);
            cmsMap.put("confidence", cms.confidence);
            cmsMap.put("signals", cms.signals);
        }
        data.put("inputUrl", inputUrl);
        data.put("normalizedUrl", normalizedUrl);
        data.put("finalUrl", finalUrl);
        data.put("cms", cmsMap);
        data.put("nextJs", nextData);
        data.put("frontendFramework", Map.of("name", frontend.name, "confidence", frontend.confidence, "signals", frontend.signals));
        data.put("backendHints", backendHints);
        data.put("cloudflare", cloudflare);
        data.put("serverHeader", serverHeader);
        data.put("xPoweredBy", poweredBy);
        data.put("durationMs", durationMs);

        logger.info("TECH module done: cms={}({}) frontend={}({}) backendHints={} cloudflare={}",
            cms.name, cms.confidence, frontend.name, frontend.confidence, backendHints.size(), cloudflare
        );

        return new AuditModuleResult(
            moduleId(),
            "Technology",
            summary,
            data,
            checks
        );
    }

    /**
     * Implémentation AuditModuleAnalyzer : MVP.
     * Comme l'interface ne fournit pas encore headers/html, on retourne un module "warning".
     * L'orchestrator doit appeler analyzeTech(...).
     */
    @Override
    public AuditModuleResult analyze(AuditContext auditContext, Logger logger) {
        logger.debug("TECH module called.");
        return analyzeTech(auditContext.inputUrl(), auditContext.normalizedUrl(), auditContext.finalUrl(), auditContext.headers(), auditContext.body(), logger);
    }

    // -------------------------
    // Detection methods
    // -------------------------

    private static DetectedTech detectCms(Map<String, String> headers, String html) {
        if (html == null) html = "";

        String h = concat(headers) + "\n" + html;

        // WordPress
        if (matchesAny(WP_GENERATOR_PATTERN, html) || matchesAny(WP_CONTENT_PATTERN, html)) {
            return new DetectedTech("WordPress", 0.85, List.of("wp-content/wp-includes/wp-json or generator"));
        }

        if (matchesAny(SHOPIFY_PATTERN, h)) {
            return new DetectedTech("Shopify", 0.85, List.of("cdn.shopify.com / shopify-section / cart.js / x-shopify"));
        }

        if (matchesAny(WIX_PATTERN, h)) {
            return new DetectedTech("Wix", 0.8, List.of("wix signals"));
        }

        if (matchesAny(SQUARESPACE_PATTERN, h)) {
            return new DetectedTech("Squarespace", 0.75, List.of("squarespace signals"));
        }

        if (matchesAny(WEBFLOW_PATTERN, h)) {
            return new DetectedTech("Webflow", 0.8, List.of("webflow signals"));
        }

        if (matchesAny(GHOST_PATTERN, h)) {
            return new DetectedTech("Ghost", 0.8, List.of("ghost signals"));
        }

        if (matchesAny(DRUPAL_PATTERN, h)) {
            return new DetectedTech("Drupal", 0.7, List.of("drupal signals"));
        }

        if (matchesAny(JOOMLA_PATTERN, h)) {
            return new DetectedTech("Joomla", 0.65, List.of("joomla signals"));
        }

        return new DetectedTech(null, 0.0, List.of());
    }

    private static DetectedTech detectFrontendFramework(Map<String, String> headers, String html) {
        if (html == null) html = "";
        String h = concat(headers) + "\n" + html;

        // Next / Nuxt / Gatsby (SSR/SSG)
        if (matchesAny(NEXT_PATTERN, h)) {
            return new DetectedTech("Next.js", 0.85, List.of("__NEXT_DATA__ or /_next/"));
        }
        if (matchesAny(NUXT_PATTERN, h)) {
            return new DetectedTech("Nuxt", 0.85, List.of("__NUXT__ or /_nuxt/"));
        }
        if (matchesAny(GATSBY_PATTERN, h)) {
            return new DetectedTech("Gatsby", 0.75, List.of("gatsby / page-data / ___gatsby"));
        }

        // SPA frameworks
        if (matchesAny(ANGULAR_PATTERN, h)) {
            return new DetectedTech("Angular", 0.75, List.of("ng-version / _ngcontent"));
        }
        if (matchesAny(VUE_PATTERN, h)) {
            return new DetectedTech("Vue", 0.7, List.of("vue signals"));
        }
        if (matchesAny(REACT_PATTERN, h)) {
            return new DetectedTech("React", 0.65, List.of("react signals"));
        }
        if (matchesAny(SVELTE_PATTERN, h)) {
            return new DetectedTech("Svelte", 0.65, List.of("svelte signals"));
        }

        return new DetectedTech("unknown", 0.0, List.of());
    }

    private static List<String> detectBackendHints(
        Map<String, String> headers,
        String poweredBy,
        String setCookie,
        String server,
        String html
    ) {
        List<String> hints = new ArrayList<>();
        String combined = concat(headers)
            + "\nserver=" + safe(server)
            + "\nx-powered-by=" + safe(poweredBy)
            + "\nset-cookie=" + safe(setCookie)
            + "\n" + (html != null ? html : "");

        if (matchesAny(PHP_HINT_PATTERN, combined)) {
            hints.add("PHP");
        }
        if (matchesAny(ASPNET_HINT_PATTERN, combined)) {
            hints.add("ASP.NET");
        }
        if (matchesAny(JAVA_HINT_PATTERN, combined)) {
            hints.add("Java");
        }
        if (matchesAny(NODE_HINT_PATTERN, combined)) {
            hints.add("Node.js");
        }
        if (matchesAny(NGINX_HINT_PATTERN, combined)) {
            hints.add("Nginx");
        }
        if (matchesAny(APACHE_HINT_PATTERN, combined)) {
            hints.add("Apache");
        }
        if (matchesAny(CLOUDFLARE_HINT_PATTERN, combined)) {
            hints.add("Cloudflare");
        }

        // dédoublonne
        return hints.stream().distinct().toList();
    }

    // -------------------------
    // Helpers
    // -------------------------

    private static boolean matchesAny(Pattern pattern, String input) {
        return input != null && pattern.matcher(input).find();
    }

    private static String concat(Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        headers.forEach((k, v) -> sb.append(k).append(": ").append(v).append("\n"));
        return sb.toString();
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static final class DetectedTech {
        final String name;
        final double confidence;
        final List<String> signals;

        private DetectedTech(String name, double confidence, List<String> signals) {
            this.name = name;
            this.confidence = confidence;
            this.signals = signals != null ? signals : List.of();
        }
    }
}
