package com.dokor.argos.services.analysis.modules.ssl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Singleton
public class SslLabsClient {

    private static final String API_BASE = "https://api.ssllabs.com/api/v3";
    private static final int MAX_POLLS = 10;
    private static final long POLL_INTERVAL_MS = 6_000L;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Inject
    public SslLabsClient(ObjectMapper objectMapper) {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Starts a new SSL Labs analysis for the given host and polls until READY or ERROR.
     * Throws if the API is unavailable or times out.
     */
    public JsonNode analyze(String host) throws Exception {
        // Start the analysis
        JsonNode result = get(API_BASE + "/analyze?host=" + host + "&startNew=on&all=done");

        for (int i = 0; i < MAX_POLLS; i++) {
            String status = result.path("status").asText("");
            if ("READY".equals(status) || "ERROR".equals(status)) {
                return result;
            }
            Thread.sleep(POLL_INTERVAL_MS);
            result = get(API_BASE + "/analyze?host=" + host + "&all=done");
        }

        // Return whatever we have after timeout (may be partial)
        return result;
    }

    private JsonNode get(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(30))
            .header("User-Agent", "argos-auditor/1.0")
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 429) {
            throw new RuntimeException("SSL Labs API rate limit exceeded (HTTP 429)");
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("SSL Labs API returned HTTP " + response.statusCode());
        }

        return objectMapper.readTree(response.body());
    }
}
