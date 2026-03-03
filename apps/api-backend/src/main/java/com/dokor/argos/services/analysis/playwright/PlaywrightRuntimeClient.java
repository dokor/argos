package com.dokor.argos.services.analysis.playwright;

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
public class PlaywrightRuntimeClient {

    private final HttpClient http;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String PLAYWRIGHT_SERVICE_URL = "http://playwright-service:3016";

    @Inject
    public PlaywrightRuntimeClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

        // ex: http://playwright-service:3016
        this.baseUrl = System.getenv().getOrDefault("PLAYWRIGHT_SERVICE_URL", PLAYWRIGHT_SERVICE_URL);
    }

    public RuntimeAnalyzeResponse analyzeRuntime(String url) throws Exception {
        URI endpoint = URI.create(baseUrl + "/analyze/runtime");

        String body = objectMapper.writeValueAsString(Map.of("url", url));

        HttpRequest req = HttpRequest.newBuilder(endpoint)
            .timeout(Duration.ofSeconds(60))
            .header("content-type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());

        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new IllegalStateException("Playwright service error status=" + res.statusCode() + " body=" + truncate(res.body(), 500));
        }

        return objectMapper.readValue(res.body(), RuntimeAnalyzeResponse.class);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    // DTO (match la réponse Node)
    public record RuntimeAnalyzeResponse(
        String url,
        String finalUrl,
        Timings timings,
        Console console,
        JsErrors jsErrors,
        Network network
    ) {
    }

    public record Timings(
        Long domContentLoadedMs,
        Long loadMs
    ) {
    }

    public record Console(
        Integer errors,
        Integer warnings,
        java.util.List<ConsoleSample> samples
    ) {
    }

    public record ConsoleSample(
        String type,
        String text,
        String location
    ) {
    }

    public record JsErrors(
        Integer count,
        java.util.List<JsErrorSample> samples
    ) {
    }

    public record JsErrorSample(
        String message
    ) {
    }

    public record Network(
        Integer requests,
        Integer failedRequests,
        Integer status4xx,
        Integer status5xx,
        Long totalBytesEstimated,
        Map<String, Integer> byType,
        java.util.List<LargestResource> topLargest
    ) {
    }

    public record LargestResource(
        String url,
        Long bytes,
        String type,
        Integer status
    ) {
    }
}
