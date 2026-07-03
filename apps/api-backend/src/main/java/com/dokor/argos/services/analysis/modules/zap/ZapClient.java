package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.logging.ExternalServiceCall;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Singleton
public class ZapClient {

    private static final Logger logger = LoggerFactory.getLogger(ZapClient.class);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String zapApiUrl;

    @Inject
    public ZapClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        String envUrl = System.getenv("ZAP_API_URL");
        this.zapApiUrl = (envUrl != null && !envUrl.isBlank()) ? envUrl : "http://localhost:8080";
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    }

    /**
     * Retrieves passive scan alerts for the given target URL.
     */
    public JsonNode getAlerts(String targetUrl) throws Exception {
        return ExternalServiceCall.timed(logger, "zap", targetUrl, () -> {
            String encodedTarget = URLEncoder.encode(targetUrl, StandardCharsets.UTF_8);
            String url = zapApiUrl + "/JSON/core/view/alerts/?baseurl=" + encodedTarget + "&start=0&count=100";

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("User-Agent", "argos-auditor/1.0")
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("ZAP API returned HTTP " + response.statusCode());
            }

            return objectMapper.readTree(response.body());
        });
    }
}
