package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleAnalyzer;
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
public class HttpModuleAnalyzer implements AuditModuleAnalyzer {

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

    @Override
    public String moduleId() {
        return "http";
    }

    @Override
    public AuditModuleResult analyze(AuditContext context, Logger logger) {
        long start = System.currentTimeMillis();

        String inputUrl = context.inputUrl();
        String normalizedUrl = context.normalizedUrl();
        String currentUrl = normalizedUrl != null ? normalizedUrl : inputUrl;
        List<String> redirectChain = new ArrayList<>();
        Map<String, String> lastHeaders = Map.of();
        int lastStatus = 0;
        String httpVersion = null;
        String body = null;

        List<String> errors = new ArrayList<>();

        try {
            for (int i = 0; i < MAX_REDIRECTS; i++) {
                // Revalidation SSRF à chaque saut (URL initiale + cibles de redirection),
                // au moment du fetch : bloque une redirection vers une IP interne et couvre
                // le DNS rebinding entre la soumission et le traitement (#217).
                try {
                    UrlNormalizer.validatePublicUrl(currentUrl);
                } catch (IllegalArgumentException ssrf) {
                    logger.warn("HTTP module: blocked SSRF target url={} reason={}",
                        UrlNormalizer.sanitizeForLog(currentUrl), ssrf.getMessage());
                    errors.add("SsrfBlocked: " + ssrf.getMessage());
                    break;
                }

                redirectChain.add(currentUrl);

                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(currentUrl))
                    .timeout(Duration.ofSeconds(20))
                    .header("User-Agent", "argos-auditor/1.0")
                    .header("Accept", "*/*")
                    .GET()
                    .build();

                logger.debug("HTTP module: requesting url={}", currentUrl);

                HttpResponse<String> response = client.send(request, BoundedBodyHandlers.ofString(BoundedBodyHandlers.MAX_PAGE_BYTES));

                body = response.body();
                lastStatus = response.statusCode();
                lastHeaders = flattenHeaders(response.headers());
                httpVersion = response.version() != null ? response.version().name() : null;

                logger.debug("HTTP module: response status={} url={}", lastStatus, currentUrl);

                if (isRedirect(lastStatus)) {
                    String location = response.headers().firstValue("location").orElse(null);
                    if (location == null) {
                        logger.warn("HTTP module: redirect without Location header status={} url={}", lastStatus, currentUrl);
                        errors.add("RedirectWithoutLocation");
                        break;
                    }

                    currentUrl = URI.create(currentUrl).resolve(location).toString();
                    continue;
                }

                // On s'arrête dès qu'on a une réponse finale (non-3xx)
                break;
            }
        } catch (Exception e) {
            logger.warn("HTTP module: request failed url={} error={}", currentUrl, e.toString());
            errors.add(e.getClass().getSimpleName() + ": " + e.getMessage());
        }

        long durationMs = System.currentTimeMillis() - start;

        // Détection d'une protection anti-bot (Cloudflare…) — issue #56 : on dégrade
        // proprement (statut non pénalisant + check informatif) au lieu de compter le
        // challenge comme un échec du site.
        String antiBotVendor = detectAntiBot(lastStatus, lastHeaders, body);
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
                Map.of("vendor", antiBotVendor, "statusCode", lastStatus),
                "Le site est protégé par une protection anti-bot (" + antiBotVendor + ") : l'analyse a porté "
                    + "sur la page de challenge et peut être partielle. Ce blocage n'est pas imputé au score du site.",
                null
            ));
        }

        // 2) Redirect chain size
        checks.add(checkRedirectCount(redirectChain));

        // 3) Final URL scheme (https)
        checks.add(checkFinalHttps(currentUrl));

        // 4) Redirect to HTTPS (si input est http et final https)
        checks.add(checkRedirectToHttps(inputUrl, currentUrl, redirectChain));

        // 5) Response time
        checks.add(checkResponseTime(durationMs));

        // 6) Content-Type
        checks.add(checkContentType(lastHeaders));

        // 7) Security headers (HSTS, CSP, etc.)
        checks.addAll(checkSecurityHeaders(lastHeaders));

        // 7b) Attributs de sécurité des cookies (Secure / HttpOnly) — issue #151
        checks.add(checkCookieFlags(lastHeaders));

        // 7c) Support de HTTP/2 (uniquement pertinent en HTTPS) — issue #151
        checks.add(checkHttp2(httpVersion, currentUrl));

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
        SeoResources seoResources = null;
        if (lastStatus >= 200 && lastStatus < 400) {
            seoResources = probeSeoResources(currentUrl, logger);
            checks.add(checkRobotsTxt(seoResources));
            checks.add(checkSitemap(seoResources));
        }

        String summary = buildSummary(lastStatus, redirectChain, durationMs, currentUrl);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("inputUrl", inputUrl);
        data.put("normalizedUrl", normalizedUrl);
        data.put("finalUrl", currentUrl);
        data.put("statusCode", lastStatus);
        data.put("durationMs", durationMs);
        data.put("redirectChain", redirectChain);
        data.put("headers", lastHeaders);
        data.put("httpVersion", httpVersion);
        data.put("errors", errors);
        data.put("antiBotDetected", antiBotVendor != null);
        if (antiBotVendor != null) {
            data.put("antiBotVendor", antiBotVendor);
        }
        if (seoResources != null) {
            data.put("robotsTxtPresent", seoResources.robotsPresent());
            data.put("sitemapPresent", seoResources.sitemapPresent());
        }
        data.put("body", body);

        logger.info("HTTP module done: status={} redirects={} durationMs={} finalUrl={}",
            lastStatus, Math.max(0, redirectChain.size() - 1), durationMs, currentUrl
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

    /** Marqueurs textuels d'une page de challenge anti-bot (Cloudflare & génériques). */
    private static final java.util.regex.Pattern ANTIBOT_BODY_MARKERS = java.util.regex.Pattern.compile(
        "(?i)just a moment|cf-browser-verification|_cf_chl_opt|attention required|checking your browser");

    /**
     * Détecte une protection anti-bot / challenge (Cloudflare & co.) — issue #56.
     * Retourne le fournisseur détecté ({@code "cloudflare"} / {@code "generic"}) ou
     * {@code null}. On évite les faux positifs : un simple CDN Cloudflare (en-têtes
     * {@code cf-ray} sur une 200 sans marqueur) n'est PAS un challenge.
     */
    static String detectAntiBot(int statusCode, Map<String, String> headers, String body) {
        Map<String, String> h = headers != null ? headers : Map.of();
        String server = h.getOrDefault("server", "").toLowerCase();
        boolean cloudflare = h.containsKey("cf-ray") || h.containsKey("cf-mitigated") || server.contains("cloudflare");
        boolean challengeStatus = statusCode == 403 || statusCode == 429 || statusCode == 503;
        boolean bodyMarker = body != null && ANTIBOT_BODY_MARKERS.matcher(body).find();

        // Cloudflare : en-têtes CF + (statut de challenge OU marqueur de challenge).
        if (cloudflare && (challengeStatus || bodyMarker)) {
            return "cloudflare";
        }
        // Générique : marqueur explicite de challenge sur un statut de blocage.
        if (bodyMarker && challengeStatus) {
            return "generic";
        }
        return null;
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
            Map.of("finalUrl", finalUrl),
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
            Map.of("inputUrl", inputUrl, "finalUrl", finalUrl, "redirectChain", chain),
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
     * Déterministe (lu dans l'en-tête Set-Cookie) : pas de faux positif lié au réseau.
     */
    private static AuditCheckResult checkCookieFlags(Map<String, String> headers) {
        String setCookie = headers.get("set-cookie");
        boolean hasCookies = setCookie != null && !setCookie.isBlank();
        if (!hasCookies) {
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
        String low = setCookie.toLowerCase(Locale.ROOT);
        List<String> missing = new ArrayList<>();
        if (!low.contains("secure")) missing.add("Secure");
        if (!low.contains("httponly")) missing.add("HttpOnly");
        boolean ok = missing.isEmpty();
        return AuditCheckResult.of(
            "http.security.cookie_flags",
            "Attributs de sécurité des cookies",
            ok ? AuditStatus.PASS : AuditStatus.WARN,
            ok ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false, 0.0, List.of(),
            missing,
            Map.of("secure", low.contains("secure"), "httpOnly", low.contains("httponly")),
            ok ? "Les cookies portent les attributs Secure et HttpOnly."
               : "Attribut(s) manquant(s) sur les cookies : " + String.join(", ", missing) + ".",
            ok ? null : "Ajoutez Secure (transmission en HTTPS uniquement) et HttpOnly (cookie inaccessible au JavaScript) pour limiter le vol de session."
        );
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

    /** Résultat du sondage des ressources SEO à la racine du domaine. */
    private record SeoResources(
        boolean robotsPresent,
        int robotsStatus,
        boolean sitemapPresent,
        boolean sitemapInRobots,
        boolean sitemapDirect,
        int sitemapStatus
    ) {}

    /**
     * Sonde {@code /robots.txt} et {@code /sitemap.xml} à la racine du domaine de {@code finalUrl}.
     * Le sitemap est considéré présent s'il répond en 200 <b>ou</b> s'il est déclaré via une
     * directive {@code Sitemap:} dans le robots.txt. Toute erreur réseau ⇒ ressource absente.
     */
    private SeoResources probeSeoResources(String finalUrl, Logger logger) {
        String origin = originOf(finalUrl);
        if (origin == null) {
            return new SeoResources(false, 0, false, false, false, 0);
        }

        boolean robotsPresent = false;
        boolean sitemapInRobots = false;
        int robotsStatus = 0;
        try {
            HttpResponse<String> r = getResource(origin + "/robots.txt");
            robotsStatus = r.statusCode();
            String body = r.body();
            robotsPresent = robotsStatus == 200 && body != null && !body.isBlank();
            if (robotsPresent) {
                sitemapInRobots = body.lines()
                    .anyMatch(line -> line.trim().toLowerCase(Locale.ROOT).startsWith("sitemap:"));
            }
        } catch (Exception e) {
            logger.debug("SEO probe: robots.txt fetch failed origin={} error={}", origin, e.toString());
        }

        boolean sitemapDirect = false;
        int sitemapStatus = 0;
        try {
            HttpResponse<String> s = getResource(origin + "/sitemap.xml");
            sitemapStatus = s.statusCode();
            String body = s.body();
            sitemapDirect = sitemapStatus == 200 && body != null && !body.isBlank();
        } catch (Exception e) {
            logger.debug("SEO probe: sitemap.xml fetch failed origin={} error={}", origin, e.toString());
        }

        boolean sitemapPresent = sitemapDirect || sitemapInRobots;
        return new SeoResources(robotsPresent, robotsStatus, sitemapPresent, sitemapInRobots, sitemapDirect, sitemapStatus);
    }

    private HttpResponse<String> getResource(String url) throws Exception {
        // Défense en profondeur : les probes SEO refetchent l'origine finale, revalider
        // évite d'atteindre une IP interne (rebinding entre le fetch page et le probe).
        UrlNormalizer.validatePublicUrl(url);
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(10))
            .header("User-Agent", "argos-auditor/1.0")
            .header("Accept", "*/*")
            .GET()
            .build();
        return client.send(req, BoundedBodyHandlers.ofString(BoundedBodyHandlers.MAX_PAGE_BYTES));
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

    private static AuditCheckResult checkRobotsTxt(SeoResources seo) {
        boolean present = seo.robotsPresent();
        return AuditCheckResult.of(
            "http.seo.robots_txt",
            "Présence de robots.txt",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of("present", present, "status", seo.robotsStatus()),
            present ? "Le fichier robots.txt est présent." : "Le fichier robots.txt est absent.",
            present ? null : "Ajoutez un /robots.txt pour guider les robots d'indexation et référencer votre sitemap."
        );
    }

    private static AuditCheckResult checkSitemap(SeoResources seo) {
        boolean present = seo.sitemapPresent();
        String via = seo.sitemapDirect() ? "sitemap.xml" : (seo.sitemapInRobots() ? "robots.txt" : "none");
        return AuditCheckResult.of(
            "http.seo.sitemap",
            "Présence du sitemap",
            present ? AuditStatus.PASS : AuditStatus.WARN,
            present ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            false,          // scorable filled later
            0.0,            // weight filled later
            List.of(),      // tags filled later
            present,
            Map.of(
                "present", present,
                "via", via,
                "sitemapXmlStatus", seo.sitemapStatus(),
                "declaredInRobots", seo.sitemapInRobots()
            ),
            present ? ("Sitemap détecté (via " + via + ").") : "Aucun sitemap détecté (/sitemap.xml ou robots.txt).",
            present ? null : "Publiez un sitemap.xml et référencez-le dans robots.txt pour faciliter l'indexation."
        );
    }

    // -------------------------
    // Helpers
    // -------------------------

    private static boolean isRedirect(int status) {
        return status >= 300 && status < 400;
    }

    private static Map<String, String> flattenHeaders(HttpHeaders headers) {
        Map<String, String> out = new LinkedHashMap<>();
        headers.map().forEach((k, v) -> out.put(k.toLowerCase(Locale.ROOT), String.join(", ", v)));
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
