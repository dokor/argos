package com.dokor.argos.services.analysis.modules.observatory;

import com.dokor.argos.logging.ExternalServiceCall;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.analysis.ExternalHttpClient;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

@Singleton
public class ObservatoryClient {

    private static final Logger logger = LoggerFactory.getLogger(ObservatoryClient.class);

    private final ExternalHttpClient http;
    private final String apiBase;

    @Inject
    public ObservatoryClient(ExternalHttpClient http, ConfigurationService config) {
        this.http = http;
        this.apiBase = config.observatoryApiUrl();
    }

    /**
     * Triggers a scan for the given hostname and returns the JSON result.
     * Uses POST with empty body (application/x-www-form-urlencoded).
     */
    public JsonNode scan(String hostname) throws Exception {
        return ExternalServiceCall.timed(logger, "observatory", hostname, () -> {
            URI endpoint = URI.create(apiBase + "/scan?host="
                + URLEncoder.encode(hostname, StandardCharsets.UTF_8) + "&rescan=false");
            return http.postJson(endpoint, null, "application/x-www-form-urlencoded",
                Duration.ofSeconds(30), Duration.ofSeconds(15), BoundedBodyHandlers.MAX_PAGE_BYTES, Map.of());
        });
    }

    /**
     * Récupère le détail des tests individuels d'un scan (en-têtes/politiques
     * évalués, pass/fail, description). Utilisé pour produire des recommandations
     * actionnables (issue #171). GET /tests?scan={scanId}.
     */
    public JsonNode tests(int scanId) throws Exception {
        return ExternalServiceCall.timed(logger, "observatory-tests", "scan=" + scanId, () -> {
            return http.getJson(URI.create(apiBase + "/tests?scan=" + scanId),
                Duration.ofSeconds(30), Duration.ofSeconds(15), BoundedBodyHandlers.MAX_PAGE_BYTES, Map.of());
        });
    }
}
