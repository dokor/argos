package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.AuditDeadline;
import com.dokor.argos.services.analysis.BoundedBodyHandlers;
import com.dokor.argos.services.configuration.ConfigurationService;
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
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/** Optional, non-scorable enrichment of a published report from Ahrefs' free DR API. */
@Singleton
public class AhrefsDomainRatingClient {
    private static final Logger logger = LoggerFactory.getLogger(AhrefsDomainRatingClient.class);
    private static final URI ENDPOINT = URI.create("https://api.ahrefs.com/v3/public/domain-rating-free");
    private static final Duration CACHE_TTL = Duration.ofDays(1);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(4);

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final String apiKey;
    private final URI endpoint;
    private final Clock clock;
    private final ConcurrentHashMap<String, ReportDto.DomainRating> cache = new ConcurrentHashMap<>();

    @Inject
    public AhrefsDomainRatingClient(ConfigurationService configuration, ObjectMapper mapper) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build(), mapper,
            configuration.ahrefsApiKey(), ENDPOINT, Clock.systemUTC());
    }

    AhrefsDomainRatingClient(HttpClient httpClient, ObjectMapper mapper, String apiKey, URI endpoint, Clock clock) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.endpoint = endpoint;
        this.clock = clock;
    }

    /** Returns null when unconfigured or unavailable; neither case affects the audit score. */
    public ReportDto.DomainRating get(String domain) {
        if (apiKey.isEmpty() || domain == null || domain.isBlank()) return null;
        // compute serializes concurrent lookups for this domain and reuses a recent result.
        return cache.compute(domain.toLowerCase(java.util.Locale.ROOT), (key, cached) -> {
            if (cached != null && Instant.parse(cached.fetchedAt()).plus(CACHE_TTL).isAfter(clock.instant())) {
                return cached;
            }
            return fetch(key);
        });
    }

    private ReportDto.DomainRating fetch(String domain) {
        try {
            URI uri = URI.create(endpoint + "?target=" + URLEncoder.encode(domain, StandardCharsets.UTF_8));
            HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(AuditDeadline.requestTimeout(REQUEST_TIMEOUT))
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .GET().build();
            HttpResponse<String> response = httpClient.send(request, BoundedBodyHandlers.ofString(64 * 1024));
            if (response.statusCode() != 200) {
                logger.warn("Ahrefs Domain Rating unavailable: HTTP {}", response.statusCode());
                return null;
            }
            JsonNode value = mapper.readTree(response.body()).path("domain_rating").path("domain_rating");
            if (!value.isNumber()) return null;
            double score = value.asDouble();
            if (!Double.isFinite(score) || score < 0 || score > 100) return null;
            return new ReportDto.DomainRating(score, clock.instant().toString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception e) {
            // Never log the target URL or authorization header.
            logger.warn("Ahrefs Domain Rating unavailable: {}", e.getClass().getSimpleName());
            return null;
        }
    }
}
