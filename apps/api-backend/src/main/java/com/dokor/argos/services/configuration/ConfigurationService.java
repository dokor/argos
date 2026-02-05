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


    @Inject
    public ConfigurationService(Config config) {
        this.config = config;
        logger.info("config.file sysprop=" + System.getProperty("config.file"));
        Config cfg = ConfigFactory.load();
        logger.info("Has db.url? " + cfg.hasPath("db.url"));
        if (cfg.hasPath("db.url")) {
            System.out.println("db.url=" + cfg.getString("db.url"));
        }
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
