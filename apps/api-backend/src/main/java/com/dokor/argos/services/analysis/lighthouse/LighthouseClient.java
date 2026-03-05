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

    private final HttpClient http;
    private final ObjectMapper objectMapper;
    private final String baseUrl;

    @Inject
    public LighthouseClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

        // ex: http://lighthouse-service:3017
        this.baseUrl = System.getenv().getOrDefault("LIGHTHOUSE_SERVICE_URL", "http://lighthouse-service:3017");
    }

    public JsonNode analyze(String url) throws Exception {
        URI endpoint = URI.create(baseUrl + "/analyze");
        String payload = objectMapper.writeValueAsString(Map.of("url", url));

        HttpRequest req = HttpRequest.newBuilder(endpoint)
            .timeout(Duration.ofSeconds(120)) // Lighthouse peut être plus long
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
}
