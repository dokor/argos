package com.dokor.argos.services.analysis.modules.http;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
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
                redirectChain.add(currentUrl);

                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(currentUrl))
                    .timeout(Duration.ofSeconds(20))
                    .header("User-Agent", "argos-auditor/1.0")
                    .header("Accept", "*/*")
                    .GET()
                    .build();

                logger.debug("HTTP module: requesting url={}", currentUrl);

                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

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

        // --- Construire les checks (indicateurs) ---
        List<AuditCheckResult> checks = new ArrayList<>();

        // 1) Reachable / status code
        checks.add(checkStatusCode(lastStatus));

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

        // 8) Compression (Content-Encoding)
        checks.add(checkCompression(lastHeaders));

        // 9) Cache headers (Cache-Control / Expires)
        checks.add(checkCaching(lastHeaders));

        // 10) Server header (info only)
        checks.add(checkServerHeader(lastHeaders));

        // 11) HTTP version (info)
        checks.add(new AuditCheckResult(
            "http.protocol.version",
            "HTTP protocol version",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            httpVersion,
            Map.of("httpVersion", httpVersion),
            httpVersion != null ? "Server responded using " + httpVersion : "HTTP version not available",
            null
        ));

        // 12) Errors (info)
        if (!errors.isEmpty()) {
            checks.add(new AuditCheckResult(
                "http.errors",
                "HTTP errors",
                AuditStatus.WARN,
                AuditSeverity.MEDIUM,
                errors,
                Map.of("errors", errors),
                "Some errors occurred during HTTP analysis",
                "Investigate connectivity, DNS, TLS, redirects, and server availability."
            ));
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

    private static AuditCheckResult checkStatusCode(int statusCode) {
        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (statusCode >= 200 && statusCode < 300) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "HTTP status is successful (" + statusCode + ").";
        } else if (statusCode >= 300 && statusCode < 400) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "HTTP status indicates redirection (" + statusCode + ").";
            recommendation = "Ensure redirects are expected and minimal.";
        } else if (statusCode >= 400 && statusCode < 600) {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "HTTP status indicates an error (" + statusCode + ").";
            recommendation = "Fix server response (4xx/5xx). Check routing, auth, and server health.";
        } else {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "No valid HTTP status received.";
            recommendation = "Check DNS, connectivity, TLS, and server availability.";
        }

        return new AuditCheckResult(
            "http.status_code",
            "HTTP status code",
            status,
            severity,
            statusCode,
            Map.of("statusCode", statusCode),
            message,
            recommendation
        );
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
            message = "No redirects detected.";
        } else if (redirects <= 2) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Redirects are minimal (" + redirects + ").";
        } else if (redirects <= 5) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Multiple redirects detected (" + redirects + ").";
            recommendation = "Reduce redirects to improve performance and reliability.";
        } else {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "Too many redirects detected (" + redirects + ").";
            recommendation = "Fix redirect chain to avoid loops and reduce latency.";
        }

        return new AuditCheckResult(
            "http.redirect.count",
            "Redirect count",
            status,
            severity,
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

        return new AuditCheckResult(
            "http.final_url.https",
            "Final URL uses HTTPS",
            status,
            severity,
            isHttps,
            Map.of("finalUrl", finalUrl),
            isHttps ? "Final URL uses HTTPS." : "Final URL is not HTTPS.",
            isHttps ? null : "Prefer HTTPS to protect users and improve trust."
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
            message = "Input URL is not HTTP (no need to redirect to HTTPS).";
        } else if (finalIsHttps) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "HTTP is redirected to HTTPS.";
        } else {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Input URL is HTTP and final URL is not HTTPS.";
            recommendation = "Redirect HTTP to HTTPS to improve security.";
        }

        return new AuditCheckResult(
            "http.redirect.to_https",
            "Redirect HTTP to HTTPS",
            status,
            severity,
            Map.of("inputIsHttp", inputIsHttp, "finalIsHttps", finalIsHttps),
            Map.of("inputUrl", inputUrl, "finalUrl", finalUrl, "redirectChain", chain),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkResponseTime(long durationMs) {
        AuditStatus status;
        AuditSeverity severity;
        String message;
        String recommendation = null;

        if (durationMs <= 1000) {
            status = AuditStatus.PASS;
            severity = AuditSeverity.LOW;
            message = "Response time is good (" + durationMs + " ms).";
        } else if (durationMs <= 3000) {
            status = AuditStatus.WARN;
            severity = AuditSeverity.MEDIUM;
            message = "Response time is moderate (" + durationMs + " ms).";
            recommendation = "Consider performance optimizations (caching, CDN, server tuning).";
        } else {
            status = AuditStatus.FAIL;
            severity = AuditSeverity.HIGH;
            message = "Response time is slow (" + durationMs + " ms).";
            recommendation = "Investigate server performance, network latency, and heavy redirects.";
        }

        return new AuditCheckResult(
            "http.response_time_ms",
            "Response time",
            status,
            severity,
            durationMs,
            Map.of("durationMs", durationMs),
            message,
            recommendation
        );
    }

    private static AuditCheckResult checkContentType(Map<String, String> headers) {
        String ct = headers.get("content-type");
        boolean present = ct != null && !ct.isBlank();

        AuditStatus status = present ? AuditStatus.PASS : AuditStatus.WARN;
        AuditSeverity severity = present ? AuditSeverity.LOW : AuditSeverity.MEDIUM;

        return new AuditCheckResult(
            "http.headers.content_type",
            "Content-Type header",
            status,
            severity,
            ct,
            present ? Map.of("content-type", ct) : Map.of(),
            present ? "Content-Type is present." : "Content-Type header is missing.",
            present ? null : "Return an appropriate Content-Type header (e.g. text/html; charset=utf-8)."
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
            "Consider enabling HSTS to enforce HTTPS (only if you are confident HTTPS is correctly configured)."
        ));

        out.add(checkHeaderPresence(
            headers,
            "content-security-policy",
            "http.security.csp",
            "CSP (Content-Security-Policy)",
            AuditSeverity.MEDIUM,
            "Consider adding a CSP to reduce XSS risk."
        ));

        out.add(checkHeaderPresence(
            headers,
            "x-content-type-options",
            "http.security.x_content_type_options",
            "X-Content-Type-Options",
            AuditSeverity.LOW,
            "Consider setting X-Content-Type-Options: nosniff."
        ));

        out.add(checkHeaderPresence(
            headers,
            "x-frame-options",
            "http.security.x_frame_options",
            "X-Frame-Options",
            AuditSeverity.LOW,
            "Consider setting X-Frame-Options (or frame-ancestors via CSP) to mitigate clickjacking."
        ));

        out.add(checkHeaderPresence(
            headers,
            "referrer-policy",
            "http.security.referrer_policy",
            "Referrer-Policy",
            AuditSeverity.LOW,
            "Consider setting Referrer-Policy to control referrer data leakage."
        ));

        out.add(checkHeaderPresence(
            headers,
            "permissions-policy",
            "http.security.permissions_policy",
            "Permissions-Policy",
            AuditSeverity.LOW,
            "Consider adding Permissions-Policy to limit powerful browser features."
        ));

        return out;
    }

    private static AuditCheckResult checkCompression(Map<String, String> headers) {
        String enc = headers.get("content-encoding");
        boolean enabled = enc != null && !enc.isBlank();

        return new AuditCheckResult(
            "http.headers.compression",
            "Compression (Content-Encoding)",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            enc,
            enabled ? Map.of("content-encoding", enc) : Map.of(),
            enabled ? "Compression is enabled (" + enc + ")." : "No Content-Encoding detected.",
            null
        );
    }

    private static AuditCheckResult checkCaching(Map<String, String> headers) {
        String cacheControl = headers.get("cache-control");
        String expires = headers.get("expires");

        boolean hasCachingInfo = (cacheControl != null && !cacheControl.isBlank()) || (expires != null && !expires.isBlank());

        AuditStatus status = hasCachingInfo ? AuditStatus.INFO : AuditStatus.WARN;
        AuditSeverity severity = AuditSeverity.LOW;

        return new AuditCheckResult(
            "http.headers.caching",
            "Caching headers (Cache-Control / Expires)",
            status,
            severity,
            hasCachingInfo ? Map.of("cache-control", cacheControl, "expires", expires) : Map.of(),
            hasCachingInfo ? Map.of("cache-control", cacheControl, "expires", expires) : Map.of(),
            hasCachingInfo ? "Caching headers detected." : "No caching headers detected.",
            hasCachingInfo ? null : "Consider adding Cache-Control for static assets and appropriate caching strategies."
        );
    }

    private static AuditCheckResult checkServerHeader(Map<String, String> headers) {
        String server = headers.get("server");
        return new AuditCheckResult(
            "http.headers.server",
            "Server header",
            AuditStatus.INFO,
            AuditSeverity.LOW,
            server,
            Map.of("server", server),
            server != null ? "Server header is present." : "Server header is not present.",
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

        return new AuditCheckResult(
            checkKey,
            label,
            status,
            severity,
            value,
            present ? Map.of(headerKeyLowerCase, value) : Map.of(),
            present ? (label + " is present.") : (label + " is missing."),
            present ? null : recommendationIfMissing
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
}
