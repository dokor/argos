package com.dokor.argos.services.analysis.lighthouse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Singleton
public class LighthouseClient {

    /** Timeout par défaut alloué à une analyse Lighthouse (surchargeable via LIGHTHOUSE_TIMEOUT_SECONDS). */
    private static final int DEFAULT_LIGHTHOUSE_TIMEOUT_SECONDS = 240;
    private static final String DEFAULT_URL_LIGHTHOUSE_SERVICE = "http://lighthouse-service:3017";

    private final HttpClient http;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final Duration requestTimeout;

    @Inject
    public LighthouseClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

        // ex: http://lighthouse-service:3017
        this.baseUrl = System.getenv().getOrDefault("LIGHTHOUSE_SERVICE_URL", DEFAULT_URL_LIGHTHOUSE_SERVICE);
        this.requestTimeout = Duration.ofSeconds(
            parseTimeoutSeconds(System.getenv("LIGHTHOUSE_TIMEOUT_SECONDS"), DEFAULT_LIGHTHOUSE_TIMEOUT_SECONDS));
    }

    public JsonNode analyze(String url) throws Exception {
        URI endpoint = URI.create(baseUrl + "/analyze");
        String payload = objectMapper.writeValueAsString(Map.of("url", url));

        HttpRequest req = HttpRequest.newBuilder(endpoint)
            .timeout(requestTimeout)
            .header("content-type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());

        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new IllegalStateException("Lighthouse service error status=" + res.statusCode() + " body=" + truncate(res.body(), 500));
        }

        return objectMapper.readTree(res.body());
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    /** Parse un timeout (secondes) depuis une variable d'env ; retombe sur la valeur par défaut si absent/invalide. */
    private static int parseTimeoutSeconds(String value, int defaultSeconds) {
        if (value == null || value.isBlank()) return defaultSeconds;
        try {
            int parsed = Integer.parseInt(value.trim());
            return parsed > 0 ? parsed : defaultSeconds;
        } catch (NumberFormatException e) {
            return defaultSeconds;
        }
    }
}
