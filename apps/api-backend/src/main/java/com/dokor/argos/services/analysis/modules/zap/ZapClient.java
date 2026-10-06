package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.logging.ExternalServiceCall;
import com.dokor.argos.services.analysis.AuditDeadline;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.analysis.ExternalHttpClient;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/** Passive analysis of the bounded HTTP snapshot; ZAP never sends requests to the target. */
@Singleton
public class ZapClient {
    private static final Logger logger = LoggerFactory.getLogger(ZapClient.class);
    private final ExternalHttpClient http;
    private final ObjectMapper mapper;
    private final String apiUrl;
    private final String apiKey;
    private final Duration budget;
    private final Duration pollInterval;
    private final ReentrantLock session = new ReentrantLock();

    @Inject
    public ZapClient(ObjectMapper mapper, ExternalHttpClient http, ConfigurationService config) {
        this(mapper, http, config.zapApiUrl(), config.zapApiKey(),
            Duration.ofSeconds(30), Duration.ofMillis(250));
    }

    ZapClient(ObjectMapper mapper, String apiUrl, String apiKey, Duration budget, Duration pollInterval) {
        this(mapper, new ExternalHttpClient(mapper), apiUrl, apiKey, budget, pollInterval);
    }

    private ZapClient(ObjectMapper mapper, ExternalHttpClient http, String apiUrl, String apiKey,
                      Duration budget, Duration pollInterval) {
        this.mapper = mapper;
        this.http = http;
        this.apiUrl = apiUrl.replaceAll("/+$", "");
        this.apiKey = apiKey;
        this.budget = budget;
        this.pollInterval = pollInterval;
    }

    public JsonNode analyze(AuditContext context) throws Exception {
        if (context.httpStatusCode() < 100 || context.body() == null || context.finalUrl() == null) {
            throw new IllegalStateException("HTTP snapshot unavailable for passive ZAP analysis");
        }
        byte[] body = context.body().getBytes(StandardCharsets.UTF_8);
        if (body.length > BoundedBodyHandlers.MAX_PAGE_BYTES) throw new IllegalArgumentException("HTTP snapshot too large");
        var parent = AuditDeadline.current();
        var deadline = parent == null ? new AuditDeadline(budget) : parent.child(budget);
        try (var scope = deadline.enter()) {
            if (!session.tryLock(deadline.remainingNanos(), TimeUnit.NANOSECONDS)) {
                throw new java.net.http.HttpTimeoutException("ZAP session busy (timeout)");
            }
            try {
                return ExternalServiceCall.timed(logger, "zap", context.finalUrl(), () -> {
                    // One dedicated daemon per backend. Drain cancelled work before replacing its session.
                    awaitPassiveScan(deadline);
                    requireOk(call("core/action/newSession/", Map.of("overwrite", "true")));
                    requireOk(call("exim/action/importHar/", Map.of(
                        "data", har(context, body.length), "sendRequests", "false", "maxMessages", "1")));
                    // ZAP also records internal/API messages; count only the imported target snapshot.
                    int imported = call("core/view/numberOfMessages/", Map.of("baseurl", context.finalUrl()))
                        .path("numberOfMessages").asInt(-1);
                    if (imported != 1) {
                        throw new IllegalStateException("ZAP did not import the HTTP snapshot (messages=" + imported + ")");
                    }
                    awaitPassiveScan(deadline);
                    JsonNode result = call("core/view/alerts/", Map.of(
                        "baseurl", context.finalUrl(), "start", "0", "count", "100"));
                    if (!result.path("alerts").isArray()) throw new IllegalStateException("Invalid ZAP alerts response");
                    return result;
                });
            } finally {
                session.unlock();
            }
        }
    }

    private void awaitPassiveScan(AuditDeadline deadline) throws Exception {
        while (true) {
            int remaining = call("pscan/view/recordsToScan/", Map.of()).path("recordsToScan").asInt(-1);
            if (remaining < 0) throw new IllegalStateException("Invalid ZAP passive scan status");
            if (remaining == 0) return;
            TimeUnit.NANOSECONDS.sleep(deadline.remaining(pollInterval).toNanos());
        }
    }

    private String har(AuditContext context, int bodySize) throws Exception {
        var headers = context.headers().entrySet().stream()
            // The snapshot body is already decoded; do not describe it as compressed wire bytes.
            .filter(h -> !h.getKey().equalsIgnoreCase("content-encoding") && !h.getKey().equalsIgnoreCase("content-length"))
            .map(h -> Map.of("name", h.getKey(), "value", h.getValue())).toList();
        Map<String, Object> request = Map.of("method", "GET", "url", context.finalUrl(),
            "httpVersion", "HTTP/1.1", "headers", List.of(), "queryString", List.of(),
            "cookies", List.of(), "headersSize", -1, "bodySize", 0);
        Map<String, Object> response = Map.of("status", context.httpStatusCode(), "statusText", "",
            "httpVersion", "HTTP/1.1", "headers", headers, "cookies", List.of(),
            "content", Map.of("size", bodySize, "mimeType", context.headers().getOrDefault("content-type", "text/html"),
                "text", context.body()), "redirectURL", "", "headersSize", -1, "bodySize", bodySize);
        return mapper.writeValueAsString(Map.of("log", Map.of("version", "1.2",
            "creator", Map.of("name", "Argos", "version", "1"), "entries", List.of(Map.of(
                "startedDateTime", context.startedAt().toString(), "time", context.httpDurationMs(),
                "request", request, "response", response, "cache", Map.of(),
                "timings", Map.of("send", 0, "wait", context.httpDurationMs(), "receive", 0))))));
    }

    private JsonNode call(String operation, Map<String, String> parameters) throws Exception {
        String form = parameters.entrySet().stream().map(e -> encode(e.getKey()) + "=" + encode(e.getValue()))
            .collect(java.util.stream.Collectors.joining("&"));
        Map<String, String> headers = apiKey.isBlank() ? Map.of() : Map.of("X-ZAP-API-Key", apiKey);
        JsonNode json = http.postJson(URI.create(apiUrl + "/JSON/" + operation), form,
            "application/x-www-form-urlencoded", Duration.ofSeconds(15), Duration.ofSeconds(5),
            BoundedBodyHandlers.MAX_PAGE_BYTES, headers);
        if (json.has("code")) throw new IllegalStateException("ZAP API rejected " + operation);
        return json;
    }

    private static void requireOk(JsonNode response) {
        if (!"OK".equals(response.path("Result").asText())) throw new IllegalStateException("ZAP action did not complete");
    }

    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
