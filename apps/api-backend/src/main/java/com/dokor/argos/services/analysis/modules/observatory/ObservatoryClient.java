package com.dokor.argos.services.analysis.modules.observatory;

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
public class ObservatoryClient {

    private static final String API_BASE = "https://observatory-api.mdn.mozilla.net/api/v2";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Inject
    public ObservatoryClient(ObjectMapper objectMapper) {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Triggers a scan for the given hostname and returns the JSON result.
     * Uses POST with empty body (application/x-www-form-urlencoded).
     */
    public JsonNode scan(String hostname) throws Exception {
        String url = API_BASE + "/scan?host=" + hostname + "&rescan=false";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(30))
            .header("User-Agent", "argos-auditor/1.0")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("Observatory API returned HTTP " + response.statusCode() + " for host=" + hostname);
        }

        return objectMapper.readTree(response.body());
    }
}
