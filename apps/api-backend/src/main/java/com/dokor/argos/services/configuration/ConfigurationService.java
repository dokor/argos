package com.dokor.argos.services.configuration;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import com.typesafe.config.Config;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
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
        return config.getString("internal-api.auth-password");
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
}
