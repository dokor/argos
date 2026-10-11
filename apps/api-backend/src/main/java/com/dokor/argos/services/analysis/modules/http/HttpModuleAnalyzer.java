package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.AuditModule;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Analyse "HTTP" d'une URL.
 * <p>
 * Objectif :
 * - produire un module standardisé (AuditModuleResult) composé de checks (AuditCheckResult)
 * - exploitable facilement pour le PDF et le scoring (via key/status/severity)
 * <p>
 * Notes :
 * - On ne suit pas automatiquement les redirections : on reconstruit la chaîne pour l'exposer dans le report.
 * - On se limite à MAX_REDIRECTS pour éviter les boucles.
 */
@Singleton
public class HttpModuleAnalyzer {

    private static final int MAX_REDIRECTS = 10;

    private final HttpClient client;

    @Inject
    public HttpModuleAnalyzer() {
        this(HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10))
            .build());
    }

    // package-private pour tests
    HttpModuleAnalyzer(HttpClient client) {
        this.client = client;
    }

    public String moduleId() {
        return AuditModule.HTTP.id();
    }

    public AuditModuleResult analyze(AuditContext context, Logger logger) {
        long start = System.currentTimeMillis();
        var global=com.dokor.argos.services.analysis.AuditDeadline.current();
        var redirects=(global==null?new com.dokor.argos.services.analysis.AuditDeadline(Duration.ofSeconds(30)):global.child(Duration.ofSeconds(30)));

        String inputUrl = context.inputUrl();
        String normalizedUrl = context.normalizedUrl();
        String currentUrl = normalizedUrl != null ? normalizedUrl : inputUrl;
        List<String> redirectChain = new ArrayList<>();
        Map<String, String> lastHeaders = Map.of();
        List<String> lastCookies = List.of();
        int lastStatus = 0;
        String httpVersion = null;
        String body = null;
        String lastRequestedUrl = null;
        String redirectTargetUrl = null;
        String lastResponseUrl = null;
        String finalUrl = null;
        String fetchOutcome = "REQUEST_FAILED";
        Set<String> visited = new HashSet<>();

        List<String> errors = new ArrayList<>();

        try {
            for (int i = 0; i < MAX_REDIRECTS; i++) {
                if (!visited.add(currentUrl)) {
                    fetchOutcome = "REDIRECT_LOOP";
                    errors.add("RedirectLoop");
                    break;
                }
                // Revalidation SSRF à chaque saut (URL initiale + cibles de redirection),
                // au moment du fetch : bloque une redirection vers une IP interne et couvre
                // le DNS rebinding entre la soumission et le traitement (#217).
                try {
                    UrlNormalizer.validatePublicUrl(currentUrl);
                } catch (IllegalArgumentException ssrf) {
                    logger.warn("HTTP module: blocked SSRF target url={} reason={}",
                        UrlNormalizer.sanitizeForLog(currentUrl), ssrf.getMessage());
                    fetchOutcome = "TARGET_BLOCKED";
                    errors.add("SsrfBlocked: " + ssrf.getMessage());
                    break;
                }

                redirectChain.add(currentUrl);

                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(currentUrl))
                    .timeout(redirects.remaining(Duration.ofSeconds(20)))
                    .header("User-Agent", "argos-auditor/1.0")
                    .header("Accept", "*/*")
                    .GET()
                    .build();

                logger.debug("HTTP module: requesting url={}", UrlNormalizer.sanitizeForLog(currentUrl));

                lastRequestedUrl = currentUrl;
                HttpResponse<String> response = client.send(request, BoundedBodyHandlers.ofString(BoundedBodyHandlers.MAX_PAGE_BYTES));

                lastResponseUrl = currentUrl;
                body = response.body();
                lastStatus = response.statusCode();
                lastHeaders = flattenHeaders(response.headers());
                lastCookies = response.headers().allValues("set-cookie");
                httpVersion = response.version() != null ? response.version().name() : null;

                logger.debug("HTTP module: response status={} url={}", lastStatus, UrlNormalizer.sanitizeForLog(currentUrl));

                if (isRedirect(lastStatus)) {
                    String location = response.headers().firstValue("location").orElse(null);
                    if (location == null || location.isBlank()) {
                        logger.warn("HTTP module: redirect without Location header status={} url={}", lastStatus, UrlNormalizer.sanitizeForLog(currentUrl));
                        fetchOutcome = "MISSING_LOCATION";
                        errors.add("RedirectWithoutLocation");
                        break;
                    }

                    try {
                        currentUrl = URI.create(currentUrl).resolve(location).normalize().toString();
                        redirectTargetUrl = currentUrl;
                    } catch (IllegalArgumentException invalidLocation) {
                        fetchOutcome = "INVALID_LOCATION";
                        errors.add("InvalidRedirectLocation");
                        break;
                    }
                    if (i == MAX_REDIRECTS - 1) {
                        fetchOutcome = "REDIRECT_LIMIT";
                        errors.add("RedirectLimitExceeded");
                        break;
                    }
                    continue;
                }

                // The URL, headers and body are published only as one terminal response snapshot.
                finalUrl = currentUrl;
                fetchOutcome = "COMPLETED";
                break;
            }
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            fetchOutcome = e instanceof java.net.http.HttpTimeoutException ? "TIMEOUT" : "REQUEST_FAILED";
            logger.warn("HTTP module: request failed url={} error={}", UrlNormalizer.sanitizeForLog(currentUrl), e.getClass().getSimpleName());
            errors.add(e.getClass().getSimpleName() + ": " + e.getMessage());
        }

        // Retain response identity for diagnostics, without forwarding a redirect body as target content.
        Map<String, Object> lastResponse = new LinkedHashMap<>();
        if (lastResponseUrl != null) {
            lastResponse.put("url", lastResponseUrl);
            lastResponse.put("statusCode", lastStatus);
            lastResponse.put("headers", lastHeaders);
            lastResponse.put("httpVersion", httpVersion);
        }
        boolean snapshotAvailable = finalUrl != null;
        if (!snapshotAvailable) {
            lastStatus = 0;
            lastHeaders = Map.of();
            lastCookies = List.of();
            body = null;
            httpVersion = null;
        }
        long durationMs = System.currentTimeMillis() - start;

        // Détection d'une protection anti-bot (Cloudflare…) — issue #56 : on dégrade
        // proprement (statut non pénalisant + check informatif) au lieu de compter le
        // challenge comme un échec du site.
        AntiBotDetection antiBot = detectAntiBotEvidence(lastStatus, lastHeaders, body);
        String antiBotVendor = antiBot.vendor();
        if (antiBotVendor != null) {
            logger.info("HTTP module: anti-bot challenge detected vendor={} status={}", antiBotVendor, lastStatus);
        }

        // --- Construire les checks (indicateurs) ---
        List<AuditCheckResult> checks = new ArrayList<>();

        // 1) Reachable / status code (non pénalisant si challenge anti-bot détecté)
        checks.add(checkStatusCode(lastStatus, antiBotVendor != null));

        // 1b) Protection anti-bot détectée (INFO, non scorable) — issue #56
        if (antiBotVendor != null) {
            checks.add(AuditCheckResult.of(
                "http.antibot.challenge",
                "Protection anti-bot détectée",
                AuditStatus.INFO,
                AuditSeverity.MEDIUM,
                false,
                0.0,
                List.of(),
                antiBotVendor,
                Map.of("vendor", antiBotVendor, "statusCode", lastStatus,
                    "reason", antiBot.reason(), "evidence", antiBot.evidence()),
                "Le site est protégé par une protection anti-bot (" + antiBotVendor + ") : l'analyse a porté "
                    + "sur la page de challenge et peut être partielle. Ce blocage n'est pas imputé au score du site.",
                null
            ));
        }

        // 2) Redirect chain size
        checks.add(checkRedirectCount(redirectChain));

        // 3) Final URL scheme (https)
        checks.add(checkFinalHttps(finalUrl));

        // 4) Redirect to HTTPS (si input est http et final https)
        checks.add(checkRedirectToHttps(inputUrl, finalUrl, redirectChain));

        // 5) Response time
        checks.add(checkResponseTime(durationMs));

        // 6) Content-Type
        checks.add(checkContentType(lastHeaders));

        // 7) Security headers (HSTS, CSP, etc.)
        checks.addAll(checkSecurityHeaders(lastHeaders));

        // 7b) Attributs de sécurité des cookies (Secure / HttpOnly) — issue #151
        checks.add(checkCookieFlags(lastCookies));

        // 7c) Support de HTTP/2 (uniquement pertinent en HTTPS) — issue #151
        checks.add(checkHttp2(httpVersion, finalUrl));

        // 8) Compression (Content-Encoding)
        checks.add(checkCompression(lastHeaders));

        // 9) Cache headers (Cache-Control / Expires)
        checks.add(checkCaching(lastHeaders));

        // 10) Server header (info only)
        checks.add(checkServerHeader(lastHeaders));

        // 11) HTTP version (info)
        checks.add(AuditCheckResult.of(
            "http.protocol.version",
            "HTTP protocol version",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            httpVersion,
            httpVersion != null ? Map.of("httpVersion", httpVersion) : Map.of(),
            httpVersion != null ? "Server responded using " + httpVersion : "HTTP version not available",
            null
        ));

        // 12) Errors (info)
        if (!errors.isEmpty()) {
            checks.add(AuditCheckResult.of(
                "http.errors",
                "HTTP errors",
                AuditStatus.WARN,
                AuditSeverity.MEDIUM,
                false,          // scorable filled later
                0.0,            // weight filled later
                List.of(),      // tags filled later
                errors,
                Map.of("errors", errors),
                "Des erreurs sont survenues pendant l'analyse HTTP.",
                "Examinez la connectivité, le DNS, le TLS, les redirections et la disponibilité du serveur."
            ));
        }

        // 13) SEO resources: robots.txt & sitemap.xml (tag seo).
        // On ne sonde que si le site a répondu (2xx/3xx) : inutile de refaire deux
        // fetchs sur un site injoignable, et cela évite de pénaliser le SEO d'un site
        // simplement en panne réseau.
        SeoResourceProbe.Result seoResources = null;
        if (lastStatus >= 200 && lastStatus < 400 && antiBotVendor == null) {
            seoResources = probeSeoResources(finalUrl, logger);
            checks.add(checkRobotsTxt(seoResources));
            checks.add(checkSitemap(seoResources));
        }

        String summary = buildSummary(lastStatus, redirectChain, durationMs, finalUrl);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("inputUrl", inputUrl);
        data.put("normalizedUrl", normalizedUrl);
        data.put("finalUrl", finalUrl);
        data.put("requestedUrl", lastRequestedUrl);
        data.put("targetUrl", currentUrl);
        data.put("redirectTargetUrl", redirectTargetUrl);
        data.put("lastResponse", lastResponse);
        data.put("fetchOutcome", fetchOutcome);
        data.put("responseSnapshotAvailable", snapshotAvailable);
        if (!snapshotAvailable) {
            data.put("measurementState", "UNAVAILABLE");
            data.put("measurementReason", "HTTP_FETCH_" + fetchOutcome);
            data.put("partial", true);
        }
        data.put("statusCode", lastStatus);
        data.put("durationMs", durationMs);
        data.put("redirectChain", redirectChain);
        data.put("headers", lastHeaders);
        data.put("httpVersion", httpVersion);
        data.put("errors", errors);
        data.put("antiBotDetected", antiBotVendor != null);
        data.put("antiBotReason", antiBot.reason());
        data.put("antiBotEvidence", antiBot.evidence());
        if (antiBot.cdnProvider() != null) data.put("cdnProvider", antiBot.cdnProvider());
        if (antiBotVendor != null) {
            data.put("antiBotVendor", antiBotVendor);
        }
        if (seoResources != null) {
            data.put("robotsTxtPresent", seoResources.robots().present());
            data.put("sitemapPresent", seoResources.sitemap().present());
            data.put("seoResources", Map.of("robots", seoResources.robots().diagnostics(),
                "sitemap", seoResources.sitemap().diagnostics(), "declaredSitemaps", seoResources.declarations(),
                "sitemapCandidates", seoResources.candidates().stream().map(SeoResourceProbe.Resource::diagnostics).toList()));
            if (seoResources.unavailable()) data.put("partial", true);
        }
        data.put("body", body);

        logger.info("HTTP module done: status={} redirects={} durationMs={} finalUrl={}",
            lastStatus, Math.max(0, redirectChain.size() - 1), durationMs, UrlNormalizer.sanitizeForLog(finalUrl)
        );

        return new AuditModuleResult(
            moduleId(),
            "HTTP",
            summary,
            data,
            checks
        );
    }

    // -------------------------
    // Checks builders
    // -------------------------

    static AuditCheckResult checkStatusCode(int statusCode, boolean antiBotChallenge) {
        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        // Protection anti-bot (Cloudflare…) : le statut renvoyé (403/503…) reflète le
        // challenge, pas un défaut du site. On le rend INFO (donc non scorable) pour ne
        // pas pénaliser injustement le site — issue #56. La détection est signalée par
        // le check dédié http.antibot.challenge.
        if (antiBotChallenge) {
            return AuditCheckResult.of(
                "http.status_code",
                "Code de statut HTTP",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false,
                0.0,
                List.of(),
                statusCode,
                Map.of("statusCode", statusCode, "antiBotChallenge", true),
                "Statut HTTP " + statusCode + " renvoyé par une protection anti-bot : non imputé au site.",
                null
            );
        }

        if (statusCode >= 200 && statusCode < 300) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Le statut HTTP est un succès (" + statusCode + ").";
        } else if (statusCode >= 300 && statusCode < 400) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Le statut HTTP indique une redirection (" + statusCode + ").";
            recommendation = "Assurez-vous que les redirections sont attendues et limitées.";
        } else if (statusCode >= 400 && statusCode < 600) {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "Le statut HTTP indique une erreur (" + statusCode + ").";
            recommendation = "Corrigez la réponse du serveur (4xx/5xx) : routage, authentification, état du serveur.";
        } else {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "Aucun statut HTTP valide reçu.";
            recommendation = "Vérifiez le DNS, la connectivité, le TLS et la disponibilité du serveur.";
        }

        return AuditCheckResult.of(
            "http.status_code",
            "Code de statut HTTP",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            statusCode,
            Map.of("statusCode", statusCode),
            message,
            recommendation
        );
    }

    /** Cloudflare interstitial controls, not generic CDN or embedded Turnstile assets. */
    private static final java.util.regex.Pattern CF_CHALLENGE_OPTIONS = java.util.regex.Pattern.compile(
        "(?is)<script\\b[^>]*>[^<]*\\b_cf_chl_opt\\s*=\\s*\\{");
    private static final java.util.regex.Pattern CF_CHALLENGE_ELEMENT = java.util.regex.Pattern.compile(
        "(?is)<[^>]+\\bid\\s*=\\s*['\"](?:cf-browser-verification|cf-challenge-running)['\"]");
    private static final java.util.regex.Pattern GENERIC_BROWSER_VERIFICATION = java.util.regex.Pattern.compile(
        "(?i)checking your browser before accessing");

    record AntiBotDetection(String cdnProvider, String vendor, String reason, List<String> evidence) {}

    /**
     * Détecte une protection anti-bot / challenge (Cloudflare & co.) — issue #56.
     * Retourne le fournisseur détecté ({@code "cloudflare"} / {@code "generic"}) ou
     * {@code null}. On évite les faux positifs : un simple CDN Cloudflare (en-têtes
     * {@code cf-ray}) ne confirme jamais un challenge, quel que soit le statut HTTP.
     */
    static String detectAntiBot(int statusCode, Map<String, String> headers, String body) {
        return detectAntiBotEvidence(statusCode, headers, body).vendor();
    }

    static AntiBotDetection detectAntiBotEvidence(int statusCode, Map<String, String> headers, String body) {
        Map<String, String> h = headers != null ? headers : Map.of();
        String server = h.getOrDefault("server", "").toLowerCase(Locale.ROOT);
        boolean cloudflare = h.containsKey("cf-ray") || h.containsKey("cf-mitigated") || server.contains("cloudflare");
        String cdn = cloudflare ? "cloudflare" : null;
        // Explicit response signal, including challenges served with HTTP 200.
        // https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/
        if ("challenge".equalsIgnoreCase(h.getOrDefault("cf-mitigated", "").trim())) {
            return new AntiBotDetection("cloudflare", "cloudflare", "CF_MITIGATED_CHALLENGE",
                List.of("header:cf-mitigated=challenge"));
        }
        var evidence = new ArrayList<String>();
        if (body != null && CF_CHALLENGE_OPTIONS.matcher(body).find()) evidence.add("html:cloudflare-challenge-options");
        if (body != null && CF_CHALLENGE_ELEMENT.matcher(body).find()) evidence.add("html:cloudflare-verification-element");
        if (!evidence.isEmpty()) {
            return new AntiBotDetection(cdn, "cloudflare", "CLOUDFLARE_CHALLENGE_HTML", List.copyOf(evidence));
        }
        if (body != null && GENERIC_BROWSER_VERIFICATION.matcher(body).find()
            && (statusCode == 200 || statusCode == 403 || statusCode == 429 || statusCode == 503)) {
            return new AntiBotDetection(cdn, "generic", "BROWSER_VERIFICATION_PAGE",
                List.of("body:checking-your-browser-before-accessing"));
        }
        // Ambiguous errors remain ordinary HTTP failures; they do not exclude other modules.
        return new AntiBotDetection(cdn, null, statusCode >= 400 && statusCode < 600
            ? "HTTP_ERROR_WITHOUT_CHALLENGE_EVIDENCE" : "NO_CHALLENGE_EVIDENCE", List.of());
    }

    private static AuditCheckResult checkRedirectCount(List<String> chain) {
        int redirects = Math.max(0, chain.size() - 1);

        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (redirects == 0) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Aucune redirection détectée.";
        } else if (redirects <= 2) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Redirections limitées (" + redirects + ").";
        } else if (redirects <= 5) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Plusieurs redirections détectées (" + redirects + ").";
            recommendation = "Réduisez les redirections pour améliorer les performances et la fiabilité.";
        } else {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "Trop de redirections détectées (" + redirects + ").";
            recommendation = "Corrigez la chaîne de redirections pour éviter les boucles et réduire la latence.";
        }

        return AuditCheckResult.of(
            "http.redirect.count",
            "Nombre de redirections",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            redirects,
            Map.of("redirectChain", chain),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkFinalHttps(String finalUrl) {
        boolean isHttps = finalUrl != null && finalUrl.toLowerCase(Locale.ROOT).startsWith("https://");

        AuditStatus status = isHttps ? AuditStatus.PASS : AuditStatus.WARN;
        AuditSeverity severity = isHttps ? AuditSeverity.LOW : AuditSeverity.MEDIUM;

        return AuditCheckResult.of(
            "http.final_url.https",
            "URL finale en HTTPS",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            isHttps,
            finalUrl != null ? Map.of("finalUrl", finalUrl) : Map.of("reason", "FINAL_RESPONSE_UNAVAILABLE"),
            isHttps ? "L'URL finale utilise HTTPS." : "L'URL finale n'utilise pas HTTPS.",
            isHttps ? null : "Privilégiez HTTPS pour protéger les visiteurs et renforcer la confiance."
        );
    }

    private static AuditCheckResult checkRedirectToHttps(String inputUrl, String finalUrl, List<String> chain) {
        boolean inputIsHttp = inputUrl != null && inputUrl.toLowerCase(Locale.ROOT).startsWith("http://");
        boolean finalIsHttps = finalUrl != null && finalUrl.toLowerCase(Locale.ROOT).startsWith("https://");

        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (!inputIsHttp) {
            status = AuditStatus.INFO;
            severity = AuditSeverity.LOW;
            message = "L'URL soumise n'est pas en HTTP (redirection vers HTTPS inutile).";
        } else if (finalIsHttps) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Le HTTP est bien redirigé vers HTTPS.";
        } else {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "L'URL soumise est en HTTP et l'URL finale n'est pas en HTTPS.";
            recommendation = "Redirigez le HTTP vers HTTPS pour améliorer la sécurité.";
        }

        return AuditCheckResult.of(
            "http.redirect.to_https",
            "Redirection HTTP vers HTTPS",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            Map.of("inputIsHttp", inputIsHttp, "finalIsHttps", finalIsHttps),
            finalUrl != null ? Map.of("inputUrl", inputUrl, "finalUrl", finalUrl, "redirectChain", chain)
                : Map.of("inputUrl", inputUrl, "reason", "FINAL_RESPONSE_UNAVAILABLE", "redirectChain", chain),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkResponseTime(long durationMs) {
        // Purement informatif (non scoré) : cette durée est la latence de fetch de l'audit
        // lui-même (redirections incluses), mesurée depuis le worker Argos et donc dépendante
        // de son réseau. La transformer en WARN/FAIL produisait des faux positifs non
        // déterministes. La performance perçue est déjà couverte par Lighthouse (métrique
        // stable côté client). Cf. issue #100 - point "temps de réponse".
        return AuditCheckResult.of(
            "http.response_time_ms",
            "Response time",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            durationMs,
            Map.of("durationMs", durationMs),
            "Auditor fetch time: " + durationMs + " ms (network-dependent, informational only).",
            null
        );
    }

    private static AuditCheckResult checkContentType(Map<String, String> headers) {
        String ct = headers.get("content-type");
        boolean present = ct != null && !ct.isBlank();

        AuditStatus status = present ? AuditStatus.PASS : AuditStatus.WARN;
        AuditSeverity severity = present ? AuditSeverity.LOW : AuditSeverity.MEDIUM;

        return AuditCheckResult.of(
            "http.headers.content_type",
            "En-tête Content-Type",
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            ct,
            present ? Map.of("content-type", ct) : Map.of(),
            present ? "L'en-tête Content-Type est présent." : "L'en-tête Content-Type est absent.",
            present ? null : "Renvoyez un en-tête Content-Type approprié (ex. text/html; charset=utf-8)."
        );
    }

    private static List<AuditCheckResult> checkSecurityHeaders(Map<String, String> headers) {
        List<AuditCheckResult> out = new ArrayList<>();

        out.add(checkHeaderPresence(
            headers,
            "strict-transport-security",
            "http.security.hsts",
            "HSTS (Strict-Transport-Security)",
            AuditSeverity.MEDIUM,
            "Activez HSTS pour forcer HTTPS (uniquement si HTTPS est correctement configuré)."
        ));

        out.add(checkHeaderPresence(
            headers,
            "content-security-policy",
            "http.security.csp",
            "CSP (Content-Security-Policy)",
            AuditSeverity.MEDIUM,
            "Ajoutez une Content-Security-Policy (CSP) pour réduire le risque de XSS."
        ));

        out.add(checkHeaderPresence(
            headers,
            "x-content-type-options",
            "http.security.x_content_type_options",
            "X-Content-Type-Options",
            AuditSeverity.LOW,
            "Définissez l'en-tête X-Content-Type-Options: nosniff."
        ));

        out.add(checkHeaderPresence(
            headers,
            "x-frame-options",
            "http.security.x_frame_options",
            "X-Frame-Options",
            AuditSeverity.LOW,
            "Définissez X-Frame-Options (ou frame-ancestors via CSP) pour limiter le clickjacking."
        ));

        out.add(checkHeaderPresence(
            headers,
            "referrer-policy",
            "http.security.referrer_policy",
            "Referrer-Policy",
            AuditSeverity.LOW,
            "Définissez Referrer-Policy pour maîtriser la fuite d'informations de provenance."
        ));

        out.add(checkHeaderPresence(
            headers,
            "permissions-policy",
            "http.security.permissions_policy",
            "Permissions-Policy",
            AuditSeverity.LOW,
            "Ajoutez Permissions-Policy pour restreindre les fonctionnalités sensibles du navigateur."
        ));

        return out;
    }

    /**
     * Attributs de sécurité des cookies posés par la réponse (Secure, HttpOnly).
     * Each Set-Cookie field is one cookie: commas (including Expires) are never separators.
     * Conservative policy: require both flags on every cookie. JavaScript-readable cookies
     * remain WARN for manual review; names alone cannot establish a safe exemption.
     * Evidence contains only ordinal positions and flags, never cookie names or values.
     */
    static AuditCheckResult checkCookieFlags(List<String> cookies) {
        if (cookies.isEmpty()) {
            return AuditCheckResult.of(
                "http.security.cookie_flags",
                "Attributs de sécurité des cookies",
                AuditStatus.PASS,
                AuditSeverity.LOW,
                false, 0.0, List.of(),
                false,
                Map.of(),
                "Aucun cookie posé par la réponse.",
                null
            );
        }
        List<Map<String, Object>> observations = new ArrayList<>();
        int missingSecure = 0;
        int missingHttpOnly = 0;
        for (String cookie : cookies) {
            Set<String> attributes = cookieAttributes(cookie);
            boolean secure = attributes.contains("secure");
            boolean httpOnly = attributes.contains("httponly");
            if (!secure) missingSecure++;
            if (!httpOnly) missingHttpOnly++;
            observations.add(Map.of("index", observations.size() + 1, "secure", secure, "httpOnly", httpOnly));
        }
        List<String> missing = new ArrayList<>();
        if (missingSecure > 0) missing.add("Secure");
        if (missingHttpOnly > 0) missing.add("HttpOnly");
        boolean ok = missing.isEmpty();
        return AuditCheckResult.of(
            "http.security.cookie_flags",
            "Attributs de sécurité des cookies",
            ok ? AuditStatus.PASS : AuditStatus.WARN,
            ok ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of(),
            missing,
            Map.of("secure", missingSecure == 0, "httpOnly", missingHttpOnly == 0,
                "cookieCount", cookies.size(), "missingSecureCount", missingSecure,
                "missingHttpOnlyCount", missingHttpOnly, "cookies", observations,
                "httpOnlyPolicy", "REQUIRE_ALL_REVIEW_JAVASCRIPT_EXCEPTIONS"),
            ok ? "Les cookies portent les attributs Secure et HttpOnly."
               : "Attribut(s) manquant(s) sur au moins un cookie : " + String.join(", ", missing) + ".",
            ok ? null : "Ajoutez Secure à chaque cookie et HttpOnly aux cookies de session ou sensibles. "
                + "Si un cookie doit être accessible au JavaScript, vérifiez manuellement cette exception "
                + "et assurez-vous qu'il ne contient aucun secret de session ; elle reste signalée par cet audit."
        );
    }

    private static Set<String> cookieAttributes(String cookie) {
        Set<String> attributes = new HashSet<>();
        // Skip the name/value pair, and do not interpret text inside quoted values as flags.
        boolean quoted = false;
        boolean first = true;
        int start = 0;
        for (int i = 0; i <= cookie.length(); i++) {
            if (i < cookie.length() && cookie.charAt(i) == '"') quoted = !quoted;
            if (i == cookie.length() || (cookie.charAt(i) == ';' && !quoted)) {
                if (!first) attributes.add(cookie.substring(start, i).trim().toLowerCase(Locale.ROOT));
                first = false;
                start = i + 1;
            }
        }
        return attributes;
    }

    /**
     * Support de HTTP/2 (multiplexage, meilleures performances). Évalué uniquement
     * en HTTPS : en clair, HTTP/2 n'est pas négociable et l'absence de HTTPS est déjà
     * signalée par un autre check (pas de double pénalité).
     */
    private static AuditCheckResult checkHttp2(String httpVersion, String finalUrl) {
        boolean https = finalUrl != null && finalUrl.toLowerCase(Locale.ROOT).startsWith("https://");
        boolean http2 = "HTTP_2".equals(httpVersion) || "HTTP_3".equals(httpVersion);
        String shown = httpVersion != null ? httpVersion : "inconnu";
        if (!https) {
            return AuditCheckResult.of(
                "http.protocol.http2",
                "Support de HTTP/2",
                AuditStatus.INFO,
                AuditSeverity.LOW,
                false, 0.0, List.of(),
                httpVersion,
                Map.of("httpVersion", shown),
                "HTTP/2 non évalué (site non servi en HTTPS).",
                null
            );
        }
        return AuditCheckResult.of(
            "http.protocol.http2",
            "Support de HTTP/2",
            http2 ? AuditStatus.PASS : AuditStatus.WARN,
            AuditSeverity.LOW,
            false, 0.0, List.of(),
            httpVersion,
            Map.of("httpVersion", shown),
            http2 ? "Le site répond en HTTP/2 (ou supérieur)." : "Le site répond en HTTP/1.1.",
            http2 ? null : "Activez HTTP/2 (au niveau du serveur ou du CDN) pour améliorer les performances de chargement grâce au multiplexage."
        );
    }

    private static AuditCheckResult checkCompression(Map<String, String> headers) {
        String enc = headers.get("content-encoding");
        boolean enabled = enc != null && !enc.isBlank();

        return AuditCheckResult.of(
            "http.headers.compression",
            "Compression (Content-Encoding)",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            enc,
            enabled ? Map.of("content-encoding", enc) : Map.of(),
            enabled ? "Compression activée (" + enc + ")." : "Aucun Content-Encoding détecté.",
            null
        );
    }

    private static AuditCheckResult checkCaching(Map<String, String> headers) {
        String cacheControl = headers.get("cache-control");
        String expires = headers.get("expires");
        boolean hasCacheControl = (cacheControl != null && !cacheControl.isBlank());
        boolean hasExpires = (expires != null && !expires.isBlank());
        boolean hasCachingInfo = hasCacheControl || hasExpires;

        // Toujours INFO (non scoré) : l'absence de header de cache sur le document HTML est
        // souvent le comportement CORRECT (page dynamique/personnalisée qui ne doit pas être
        // mise en cache). Warner ici produisait un faux positif. La recommandation reste
        // affichée à titre indicatif. Cf. issue #100 - point "cache HTTP sur du HTML".
        return AuditCheckResult.of(
            "http.headers.caching",
            "Caching headers (Cache-Control / Expires)",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            (hasCacheControl && hasExpires) ? Map.of("cache-control", cacheControl, "expires", expires) : Map.of(),
            (hasCacheControl && hasExpires) ? Map.of("cache-control", cacheControl, "expires", expires) : Map.of(),
            hasCachingInfo ? "En-têtes de cache détectés." : "Aucun en-tête de cache sur le document HTML (souvent normal pour une page dynamique).",
            hasCachingInfo ? null : "Définissez un Cache-Control explicite sur les ressources statiques (JS/CSS/images) plutôt que sur le document HTML."
        );
    }

    private static AuditCheckResult checkServerHeader(Map<String, String> headers) {
        String server = headers.get("server");
        return AuditCheckResult.of(
            "http.headers.server",
            "Server header",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            server,
            server != null ? Map.of("server", server) : Map.of(),
            server != null ? "L'en-tête Server est présent." : "L'en-tête Server est absent.",
            null
        );
    }

    private static AuditCheckResult checkHeaderPresence(
        Map<String, String> headers,
        String headerKeyLowerCase,
        String checkKey,
        String label,
        AuditSeverity severity,
        String recommendationIfMissing
    ) {
        String value = headers.get(headerKeyLowerCase);
        boolean present = value != null && !value.isBlank();

        AuditStatus status = present ? AuditStatus.PASS : AuditStatus.WARN;

        return AuditCheckResult.of(
            checkKey,
            label,
            status,
            severity,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            value,
            present ? Map.of(headerKeyLowerCase, value) : Map.of(),
            present ? (label + " est présent.") : (label + " est absent."),
            present ? null : recommendationIfMissing
        );
    }

    // -------------------------
    // SEO resources (robots.txt / sitemap.xml)
    // -------------------------

    private SeoResourceProbe.Result probeSeoResources(String finalUrl, Logger logger) {
        return new SeoResourceProbe(client, logger).collect(originOf(finalUrl));
    }

    /** Reconstruit l'origine (scheme://host[:port]) à partir d'une URL, ou null si invalide. */
    private static String originOf(String url) {
        try {
            URI u = URI.create(url);
            if (u.getScheme() == null || u.getHost() == null) return null;
            StringBuilder sb = new StringBuilder(u.getScheme()).append("://").append(u.getHost());
            if (u.getPort() != -1) sb.append(':').append(u.getPort());
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static AuditCheckResult checkRobotsTxt(SeoResourceProbe.Result seo) {
        return seoCheck("http.seo.robots_txt", "Présence de robots.txt", seo.robots(), Map.of(),
            "Le fichier robots.txt est reconnu.", "Le fichier robots.txt est absent.",
            "La réponse de robots.txt ne contient pas un fichier robots reconnu.",
            "Ajoutez un /robots.txt valide pour guider les robots d'indexation.");
    }

    private static AuditCheckResult checkSitemap(SeoResourceProbe.Result seo) {
        return seoCheck("http.seo.sitemap", "Présence du sitemap", seo.sitemap(),
            Map.of("declaredInRobots", !seo.declarations().isEmpty(), "declaredSitemaps", seo.declarations(),
                "sitemapCandidates", seo.candidates().stream().map(SeoResourceProbe.Resource::diagnostics).toList()),
            "Un sitemap XML a été vérifié.", "Aucun sitemap vérifié détecté.",
            "La réponse du sitemap ne contient pas un sitemap XML reconnu.",
            "Publiez un sitemap XML valide et référencez-le dans robots.txt.");
    }

    private static AuditCheckResult seoCheck(String key, String title, SeoResourceProbe.Resource resource,
                                             Map<String, Object> extra, String recognized, String absent,
                                             String invalid, String recommendation) {
        var state = resource.state();
        boolean unavailable = state == SeoResourceProbe.State.UNAVAILABLE;
        boolean present = state == SeoResourceProbe.State.RECOGNIZED;
        Map<String, Object> details = new LinkedHashMap<>(resource.diagnostics());
        details.putAll(extra);
        details.put("present", resource.present());
        details.put("verified", present);
        details.put("measurementState", unavailable ? "UNAVAILABLE" : "MEASURED");
        details.put("measurementReason", "SEO_PROBE_" + resource.reason());
        String message = switch (state) {
            case RECOGNIZED -> recognized;
            case ABSENT -> absent;
            case INVALID -> invalid;
            case UNAVAILABLE -> "La collecte de cette ressource SEO est indisponible (" + resource.reason() + ").";
        };
        return AuditCheckResult.of(key, title,
            unavailable ? AuditStatus.INFO : present ? AuditStatus.PASS : AuditStatus.WARN,
            present || unavailable ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of(), resource.present(), details, message,
            present || unavailable ? null : recommendation);
    }

    // -------------------------
    // Helpers
    // -------------------------

    private static boolean isRedirect(int status) {
        return status >= 300 && status < 400;
    }

    private static Map<String, String> flattenHeaders(HttpHeaders headers) {
        Map<String, String> out = new LinkedHashMap<>();
        headers.map().forEach((k, v) -> {
            // Preserve cookie-name technology hints without publishing credentials in data/context.
            List<String> safeValues = k.equalsIgnoreCase("set-cookie")
                ? v.stream().map(cookie -> {
                    int equals = cookie.indexOf('=');
                    return equals > 0 ? cookie.substring(0, equals) + "=[redacted]" : "[redacted]";
                }).toList() : v;
            out.put(k.toLowerCase(Locale.ROOT), String.join(", ", safeValues));
        });
        return out;
    }

    private static String buildSummary(int status, List<String> chain, long durationMs, String finalUrl) {
        int redirects = Math.max(0, chain.size() - 1);
        return "status=" + status
            + ", redirects=" + redirects
            + ", durationMs=" + durationMs
            + ", finalUrl=" + finalUrl;
    }

    // -------------------------
    // Context enrichment
    // -------------------------

    /**
     * Enrichit un {@link AuditContext} avec les données produites par ce module HTTP.
     * <p>
     * Centralise l'extraction des clés de la map {@code data} dans la classe qui les produit,
     * évitant la duplication de noms de clés dans l'orchestrateur.
     *
     * @param context    contexte courant (avant enrichissement HTTP)
     * @param httpResult résultat brut retourné par {@link #analyze}
     * @return nouveau contexte enrichi avec les données HTTP
     */
    public static AuditContext enrichContext(AuditContext context, AuditModuleResult httpResult) {
        Map<String, Object> data = httpResult.data();
        if (Boolean.FALSE.equals(data.get("responseSnapshotAvailable"))) {
            return context.withHttpResult(null, 0, toLong(data.get("durationMs")),
                safeStringList(data.get("redirectChain")), Map.of(), null);
        }
        return context.withHttpResult(
            (String) data.get("finalUrl"),
            toInt(data.get("statusCode")),
            toLong(data.get("durationMs")),
            safeStringList(data.get("redirectChain")),
            safeStringMap(data.get("headers")),
            (String) data.get("body")
        );
    }

    private static int toInt(Object o) {
        if (o instanceof Integer i) return i;
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s) return Integer.parseInt(s);
        return 0;
    }

    private static long toLong(Object o) {
        if (o instanceof Long l) return l;
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s) return Long.parseLong(s);
        return 0L;
    }

    @SuppressWarnings("unchecked")
    private static List<String> safeStringList(Object o) {
        if (o instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> safeStringMap(Object o) {
        if (o instanceof Map<?, ?> map) {
            Map<String, String> out = new LinkedHashMap<>();
            map.forEach((k, v) -> out.put(String.valueOf(k), v != null ? String.valueOf(v) : null));
            return out;
        }
        return Map.of();
    }
}
