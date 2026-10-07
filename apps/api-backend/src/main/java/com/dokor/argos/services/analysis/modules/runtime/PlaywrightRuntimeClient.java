package com.dokor.argos.services.analysis.modules.runtime;

import com.dokor.argos.logging.ExternalServiceCall;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.analysis.ExternalHttpClient;
import com.dokor.argos.services.analysis.AuditDeadline;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

@Singleton
public class PlaywrightRuntimeClient {

    private static final Logger logger = LoggerFactory.getLogger(PlaywrightRuntimeClient.class);

    private final ExternalHttpClient http;
    private final ObjectMapper objectMapper;
    private final ObjectMapper responseMapper;
    private final String baseUrl;
    private final Duration requestTimeout;

    @Inject
    public PlaywrightRuntimeClient(ObjectMapper objectMapper, ExternalHttpClient http, ConfigurationService config) {
        this.objectMapper = objectMapper;
        // Only this external DTO is forward-compatible; the shared/Jersey mapper
        // keeps its validation behavior for user input and persisted data.
        this.responseMapper = objectMapper.copy()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        this.http = http;
        this.baseUrl = config.playwrightServiceUrl();
        this.requestTimeout = config.playwrightTimeout();
    }

    public PlaywrightRuntimeClient(ObjectMapper objectMapper) {
        this(objectMapper, new ExternalHttpClient(objectMapper),
            new ConfigurationService(com.typesafe.config.ConfigFactory.empty()));
    }

    public RuntimeAnalyzeResponse analyzeRuntime(String url) throws Exception {
        return ExternalServiceCall.timed(logger, "playwright", url, () -> {
            URI endpoint = URI.create(baseUrl + "/analyze/runtime");

            String body = objectMapper.writeValueAsString(Map.of("url", url, "timeoutMs",
                Math.max(1, AuditDeadline.requestTimeout(requestTimeout).toMillis())));
            return parseResponse(http.postJson(endpoint, body, "application/json", requestTimeout,
                Duration.ofSeconds(5), BoundedBodyHandlers.MAX_PAGE_BYTES, Map.of()));
        });
    }

    RuntimeAnalyzeResponse parseResponse(JsonNode json) throws Exception {
        RuntimeAnalyzeResponse response = responseMapper.treeToValue(json, RuntimeAnalyzeResponse.class);
        if (response == null || blank(response.url()) || blank(response.finalUrl())
            || response.timings() == null || response.console() == null
            || response.jsErrors() == null || response.network() == null
            || !nonNegative(response.console().errors())
            || !nonNegative(response.jsErrors().count())
            || !nonNegative(response.network().requests())
            || !nonNegative(response.network().failedRequests())
            || !nonNegative(response.network().status4xx())
            || !nonNegative(response.network().status5xx())
            || !nonNegative(response.network().totalBytesEstimated())) {
            throw new IllegalStateException("Playwright service returned an incomplete runtime response");
        }
        return response;
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static boolean nonNegative(Integer value) { return value != null && value >= 0; }
    private static boolean nonNegative(Long value) { return value != null && value >= 0; }

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
        java.util.List<ConsoleSample> samples,
        // Erreurs attribuées au site lui-même (même domaine enregistrable) — issue #153.
        // null si le service playwright ne fournit pas la distinction (rétro-compat).
        Integer errorsFirstParty
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
        java.util.List<LargestResource> topLargest,
        // Champs optionnels ajoutés par playwright-service (issue #247). Null
        // signifie qu'un ancien producteur est encore déployé.
        Integer failedRequestsFirstParty,
        Integer failedRequestsThirdParty,
        Integer status5xxFirstParty,
        Integer status5xxThirdParty
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
