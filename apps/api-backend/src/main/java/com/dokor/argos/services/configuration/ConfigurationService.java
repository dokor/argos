package com.dokor.argos.services.configuration;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import com.typesafe.config.Config;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.net.URI;
import java.util.Map;

@Singleton
public class ConfigurationService {
    private static final Logger logger = LoggerFactory.getLogger(ConfigurationService.class);

    private final Config config;
    private final Map<String, String> environment;

    @Inject
    public ConfigurationService(Config config) {
        this(config, System.getenv());
    }

    ConfigurationService(Config config, Map<String, String> environment) {
        this.config = config;
        this.environment = Map.copyOf(environment);
        logger.debug("ConfigurationService has been initialized");
    }

    public String internalApiAuthUsername() {
        return config.getString("internal-api.auth-username");
    }

    /** No development/default credential: admin reads fail closed when unset. */
    public String adminApiToken() {
        return environment.getOrDefault("ADMIN_API_TOKEN",
            config.hasPath("admin-api.token") ? config.getString("admin-api.token") : "");
    }

    public String internalApiAuthPassword() {
        if (environment.containsKey("INTERNAL_API_PASSWORD")) return environment.get("INTERNAL_API_PASSWORD");
        return config.getString("internal-api.auth-password");
    }

    /** Validate before opening the DB or serving HTTP; error messages never contain values. */
    public void validateRequiredSecrets() {
        for (String path : java.util.List.of("internal-api.auth-password", "db.hikari.\"dataSource.password\"")) {
            if (!config.hasPath(path) || config.getString(path).isBlank()) {
                throw new IllegalStateException("Required external secret missing: " + path);
            }
        }
    }

    public Integer httpGrizzlyWorkerThreadsPoolSize() {
        if (!config.hasPath("http-grizzly.worker-threads-pool-size")) {
            return null;
        }
        return config.getInt("http-grizzly.worker-threads-pool-size");
    }

    public Duration auditSchedulerInterval() {
        return config.getDuration("audit.scheduler.interval");
    }

    /**
     * Durée au-delà de laquelle un run resté en {@code RUNNING} est considéré
     * comme bloqué (worker mort/redémarré ou traitement figé). Défaut : 20 min.
     */
    public Duration auditStuckRunTimeout() {
        if (!config.hasPath("audit.scheduler.stuck-timeout")) {
            return Duration.ofMinutes(20);
        }
        return config.getDuration("audit.scheduler.stuck-timeout");
    }

    /**
     * Intervalle du job de détection/reprise des runs bloqués. Défaut : 1 min.
     */
    public Duration auditStuckCheckInterval() {
        if (!config.hasPath("audit.scheduler.stuck-check-interval")) {
            return Duration.ofMinutes(1);
        }
        return config.getDuration("audit.scheduler.stuck-check-interval");
    }

    /**
     * Nombre maximal de tentatives de traitement d'un run avant abandon définitif.
     * Un run bloqué est relancé tant que {@code attempt_count < maxAttempts}, puis
     * marqué FAILED. Défaut : 3.
     */
    public int auditMaxAttempts() {
        if (!config.hasPath("audit.scheduler.max-attempts")) {
            return 3;
        }
        return config.getInt("audit.scheduler.max-attempts");
    }

    public boolean codexSummaryEnabled() {
        return Boolean.parseBoolean(environment.getOrDefault("CODEX_SUMMARY_ENABLED", "false"));
    }

    public String codexSummaryServiceUrl() {
        return environment.getOrDefault("CODEX_SUMMARY_SERVICE_URL", "http://codex-summary:3010");
    }

    public Duration codexSummaryTimeout() {
        String raw = environment.getOrDefault("CODEX_SUMMARY_TIMEOUT_SECONDS", "45");
        try {
            return Duration.ofSeconds(Math.max(5, Long.parseLong(raw)));
        } catch (NumberFormatException e) {
            return Duration.ofSeconds(45);
        }
    }

    // External services: explicit HOCON setting > existing environment variable > default.
    // An invalid selected value is an error, never a silent fallback.
    public String playwrightServiceUrl() {
        return externalUrl("external.playwright.url", "PLAYWRIGHT_SERVICE_URL", "http://playwright-service:3016");
    }

    public Duration playwrightTimeout() {
        return externalDuration("external.playwright.timeout", "PLAYWRIGHT_TIMEOUT_SECONDS", Duration.ofSeconds(60));
    }

    public String lighthouseServiceUrl() {
        return externalUrl("external.lighthouse.url", "LIGHTHOUSE_SERVICE_URL", "http://lighthouse-service:3017");
    }

    public Duration lighthouseTimeout() {
        return externalDuration("external.lighthouse.timeout", "LIGHTHOUSE_TIMEOUT_SECONDS", Duration.ofSeconds(60));
    }

    public String zapApiUrl() {
        return externalUrl("external.zap.url", "ZAP_API_URL", "http://zap:8080");
    }

    public String zapApiKey() {
        return config.hasPath("external.zap.api-key") ? config.getString("external.zap.api-key")
            : environment.getOrDefault("ZAP_API_KEY", "");
    }

    public String sslLabsApiUrl() {
        return externalUrl("external.ssl-labs.url", null, "https://api.ssllabs.com/api/v3");
    }

    public Duration sslLabsTimeout() {
        return externalDuration("external.ssl-labs.timeout", null,
            config.hasPath("ssl-labs.timeout") ? config.getDuration("ssl-labs.timeout") : Duration.ofSeconds(90));
    }

    public String observatoryApiUrl() {
        return externalUrl("external.observatory.url", null, "https://observatory-api.mdn.mozilla.net/api/v2");
    }

    private String externalUrl(String path, String envKey, String fallback) {
        String value = config.hasPath(path) ? config.getString(path)
            : envKey == null ? fallback : environment.getOrDefault(envKey, fallback);
        try {
            URI uri = URI.create(value);
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null) {
                throw new IllegalArgumentException();
            }
            return value.replaceAll("/+$", "");
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("Invalid external service URL: " + path, invalid);
        }
    }

    private Duration externalDuration(String path, String envKey, Duration fallback) {
        Duration value;
        if (config.hasPath(path)) {
            value = config.getDuration(path);
        } else if (envKey != null && environment.containsKey(envKey)) {
            try {
                value = Duration.ofSeconds(Long.parseLong(environment.get(envKey).trim()));
            } catch (RuntimeException invalid) {
                throw new IllegalArgumentException("Invalid external service timeout: " + envKey, invalid);
            }
        } else {
            value = fallback;
        }
        if (value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException("External service timeout must be positive: " + path);
        }
        return value;
    }
}
