package com.dokor.argos.services.analysis.modules.lighthouse;

import com.dokor.argos.logging.ExternalServiceCall;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.analysis.ExternalHttpClient;
import com.dokor.argos.services.analysis.AuditDeadline;
import com.dokor.argos.services.configuration.ConfigurationService;
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
public class LighthouseClient {

    private static final Logger logger = LoggerFactory.getLogger(LighthouseClient.class);

    private final ExternalHttpClient http;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final Duration requestTimeout;

    @Inject
    public LighthouseClient(ObjectMapper objectMapper, ExternalHttpClient http, ConfigurationService config) {
        this.objectMapper = objectMapper;
        this.http = http;
        this.baseUrl = config.lighthouseServiceUrl();
        this.requestTimeout = config.lighthouseTimeout();
    }

    public LighthouseClient(ObjectMapper objectMapper) {
        this(objectMapper, new ExternalHttpClient(objectMapper),
            new ConfigurationService(com.typesafe.config.ConfigFactory.empty()));
    }

    public JsonNode analyze(String url) throws Exception {
        return ExternalServiceCall.timed(logger, "lighthouse", url, () -> {
            URI endpoint = URI.create(baseUrl + "/analyze");
            String payload = objectMapper.writeValueAsString(Map.of("url", url, "timeoutMs",
                Math.max(1, AuditDeadline.requestTimeout(requestTimeout).toMillis())));
            return http.postJson(endpoint, payload, "application/json", requestTimeout,
                Duration.ofSeconds(5), BoundedBodyHandlers.MAX_JSON_BYTES, Map.of());
        });
    }
}
