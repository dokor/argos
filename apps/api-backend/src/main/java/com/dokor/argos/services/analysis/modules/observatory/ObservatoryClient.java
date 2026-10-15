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
    private final boolean externalScansEnabled;

    @Inject
    public ObservatoryClient(ExternalHttpClient http, ConfigurationService config) {
        this.http = http;
        this.apiBase = config.observatoryApiUrl();
        this.externalScansEnabled = config.externalScansEnabled();
    }

    /**
     * Triggers a scan for the given hostname and returns the JSON result.
     * Uses POST with empty body (application/x-www-form-urlencoded).
     */
    public JsonNode scan(String hostname) throws Exception {
        String target = com.dokor.argos.services.analysis.RemoteScanPolicy.requireAllowed(hostname, externalScansEnabled);
        return ExternalServiceCall.timed(logger, "observatory", hostname, () -> {
            URI endpoint = URI.create(apiBase + "/scan?host="
                + URLEncoder.encode(target, StandardCharsets.UTF_8));
            return http.postJson(endpoint, null, "application/x-www-form-urlencoded",
                Duration.ofSeconds(30), Duration.ofSeconds(15), BoundedBodyHandlers.MAX_PAGE_BYTES, Map.of());
        });
    }

    /** Compatibility seam for historical analyzer fixtures; MDN v2 has no tests endpoint. */
    public JsonNode tests(int scanId) throws Exception {
        // MDN v2 exposes aggregate scan measurements only. The retired v1 /tests route is not supported.
        return com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
    }
}
