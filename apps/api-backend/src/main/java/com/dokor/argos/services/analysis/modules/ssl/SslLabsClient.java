package com.dokor.argos.services.analysis.modules.ssl;

import com.dokor.argos.logging.ExternalServiceCall;
import com.dokor.argos.services.analysis.AuditDeadline;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.analysis.ExternalHttpClient;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Singleton
public class SslLabsClient {
    private static final Logger logger = LoggerFactory.getLogger(SslLabsClient.class);
    private final ExternalHttpClient http;
    private final String apiBase;
    private final Duration budget;
    private final Duration initialPoll;
    private final Duration runningPoll;

    @Inject
    public SslLabsClient(ExternalHttpClient http, ConfigurationService config) {
        this(http, config.sslLabsApiUrl(), config.sslLabsTimeout(),
            Duration.ofSeconds(5), Duration.ofSeconds(10));
    }

    SslLabsClient(ObjectMapper mapper, String apiBase, Duration budget, Duration initialPoll, Duration runningPoll) {
        this(new ExternalHttpClient(mapper), apiBase, budget, initialPoll, runningPoll);
    }

    private SslLabsClient(ExternalHttpClient http, String apiBase, Duration budget,
                          Duration initialPoll, Duration runningPoll) {
        if (budget.isZero() || budget.isNegative()) throw new IllegalArgumentException("SSL Labs timeout must be positive");
        this.http = http;
        this.apiBase = apiBase;
        this.budget = budget;
        this.initialPoll = initialPoll;
        this.runningPoll = runningPoll;
    }

    /** Prefer cached reports; a cache miss can start an assessment. Never force startNew. */
    public JsonNode analyze(String host) throws Exception {
        var parent = AuditDeadline.current();
        var deadline = parent == null ? new AuditDeadline(budget) : parent.child(budget);
        try (var scope = deadline.enter()) {
            return ExternalServiceCall.timed(logger, "ssllabs", host, () -> {
                String lastStatus = "UNKNOWN";
                int polls = 0;
                try {
                    while (true) {
                        JsonNode result = get(apiBase + "/analyze?host=" + URLEncoder.encode(host, StandardCharsets.UTF_8)
                            + "&fromCache=on&all=done");
                        polls++;
                        lastStatus = result.path("status").asText("UNKNOWN");
                        // Log upstream state without confusing pending results with transport failure/quota.
                        logger.info("ssl_labs_progress host={} status={} polls={} remainingMs={}",
                            com.dokor.argos.services.domain.audit.UrlNormalizer.sanitizeForLog(host),
                            com.dokor.argos.services.domain.audit.UrlNormalizer.sanitizeForLog(lastStatus),
                            polls, deadline.remainingNanos() / 1_000_000);
                        if ("READY".equals(lastStatus)) return result;
                        if ("ERROR".equals(lastStatus)) {
                            throw new IllegalStateException("SSL Labs assessment failed (status=ERROR)");
                        }
                        if (!"DNS".equals(lastStatus) && !"IN_PROGRESS".equals(lastStatus)) {
                            throw new IllegalStateException("Unexpected SSL Labs assessment status");
                        }
                        Duration interval = "IN_PROGRESS".equals(lastStatus) ? runningPoll : initialPoll;
                        TimeUnit.NANOSECONDS.sleep(deadline.remaining(interval).toNanos());
                    }
                } catch (AuditDeadline.DeadlineExceeded timeout) {
                    throw new HttpTimeoutException("SSL Labs assessment not ready within audit budget"
                        + " (timeout, lastStatus=" + lastStatus + ", polls=" + polls + ")");
                } catch (HttpTimeoutException timeout) {
                    throw new HttpTimeoutException("SSL Labs HTTP request timed out"
                        + " (lastStatus=" + lastStatus + ", polls=" + polls + ")");
                }
            });
        }
    }

    private JsonNode get(String url) throws Exception {
        try {
            JsonNode result = http.getJson(URI.create(url), Duration.ofSeconds(30), Duration.ofSeconds(15),
                BoundedBodyHandlers.MAX_PAGE_BYTES, java.util.Map.of());
            if (result.has("errors")) throw new IllegalStateException("SSL Labs API returned an invalid assessment");
            return result;
        } catch (ExternalHttpClient.HttpStatusException status) {
            if (status.statusCode() == 429) throw new IllegalStateException("SSL Labs API rate limit exceeded (HTTP 429)");
            throw status;
        }
    }
}
