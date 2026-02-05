package com.dokor.argos.services.configuration;

import com.typesafe.config.ConfigFactory;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import com.typesafe.config.Config;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Singleton
public class ConfigurationService {
    private static final Logger logger = LoggerFactory.getLogger(ConfigurationService.class);
    private final Config config;
    private final Config config1;


    @Inject
    public ConfigurationService(Config config) {
        this.config1 = ConfigFactory.parseResources("/config/prod.conf");
        this.config = ConfigFactory.load(System.getProperty("config.file")).resolve();
        logger.info("config.file sysprop=" + System.getProperty("config.file"));
        logger.info("configParam Has db.url? " + this.config.hasPath("db.url"));
        logger.info("Config Has db.url? " + this.config.hasPath("db.url"));
        logger.info("Config1 Has db.url? " + this.config1.hasPath("db.url"));
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
}
