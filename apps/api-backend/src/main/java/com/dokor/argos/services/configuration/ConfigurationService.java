package com.dokor.argos.services.configuration;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import com.typesafe.config.Config;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

@Singleton
public class ConfigurationService {
    private static final Logger logger = LoggerFactory.getLogger(ConfigurationService.class);

    private final Config config;

    @Inject
    public ConfigurationService(Config config) {
        this.config = config;
        logger.debug("ConfigurationService has been initialized");
    }

    public String internalApiAuthUsername() {
        return config.getString("internal-api.auth-username");
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
}
