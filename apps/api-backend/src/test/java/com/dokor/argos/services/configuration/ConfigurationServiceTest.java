package com.dokor.argos.services.configuration;

import com.typesafe.config.ConfigException;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.Duration;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class ConfigurationServiceTest {
    private ConfigurationService service(String config, Map<String, String> environment) {
        return new ConfigurationService(ConfigFactory.parseString(config), environment);
    }
    @Test void requiredSecretsFailBeforeStartupWithoutEchoingValues() {
        assertThrows(IllegalStateException.class, () -> service("", Map.of()).validateRequiredSecrets());
        var valid = service("""
            internal-api.auth-password="synthetic-test-internal"
            db.hikari."dataSource.password"="synthetic-db-fixture"
            """, Map.of());
        assertDoesNotThrow(valid::validateRequiredSecrets);
        var blank = service("""
            internal-api.auth-password=""
            db.hikari."dataSource.password"="synthetic-db-fixture"
            """, Map.of());
        var error = assertThrows(IllegalStateException.class, blank::validateRequiredSecrets);
        assertFalse(error.getMessage().contains("synthetic-db-fixture"));
        assertEquals("synthetic-env-value", service("", Map.of("INTERNAL_API_PASSWORD","synthetic-env-value")).internalApiAuthPassword());
    }
    @Test void startupValidatesEnvironmentCredentialUsedByAuthentication() {
        var config = """
            internal-api.auth-password="synthetic-test-internal"
            db.hikari."dataSource.password"="synthetic-db-fixture"
            """;
        for (String blank : java.util.List.of("", " ", "\t\n")) {
            var service = service(config, Map.of("INTERNAL_API_PASSWORD", blank));
            var error = assertThrows(IllegalStateException.class, service::validateRequiredSecrets);
            assertEquals("Required external secret missing or invalid: internal-api.auth-password", error.getMessage());
            assertNull(error.getCause());
            assertThrows(IllegalStateException.class, service::internalApiAuthPassword);
        }
        var external = service("""
            db.hikari."dataSource.password"="synthetic-db-fixture"
            """, Map.of("INTERNAL_API_PASSWORD", "synthetic-env-value"));
        assertDoesNotThrow(external::validateRequiredSecrets);
        assertEquals("synthetic-env-value", external.internalApiAuthPassword());
    }

    @Test void malformedSecretsFailWithoutLeakingValuesOrConfigurationCauses() {
        var valid = ConfigFactory.parseString("""
            internal-api.auth-password="synthetic-test-internal"
            db.hikari."dataSource.password"="synthetic-db-fixture"
            """);
        for (String path : java.util.List.of("internal-api.auth-password", "db.hikari.\"dataSource.password\"")) {
            for (Object value : java.util.List.of(219, true, java.util.List.of("synthetic-private-value"),
                    Map.of("private", "synthetic-private-value"), "", " \t")) {
                var config = valid.withValue(path, com.typesafe.config.ConfigValueFactory.fromAnyRef(value));
                var service = new ConfigurationService(config, Map.of());
                var error = assertThrows(IllegalStateException.class, service::validateRequiredSecrets);
                assertEquals("Required external secret missing or invalid: " + path, error.getMessage());
                assertNull(error.getCause());
            }
            for (var config : java.util.List.of(valid.withoutPath(path),
                    valid.withValue(path, com.typesafe.config.ConfigValueFactory.fromAnyRef(null)))) {
                var error = assertThrows(IllegalStateException.class,
                    new ConfigurationService(config, Map.of())::validateRequiredSecrets);
                assertEquals("Required external secret missing or invalid: " + path, error.getMessage());
                assertNull(error.getCause());
            }
        }
    }

    @Test void optionalSettingsHaveDefaultsAndRequiredSettingsRemainRequired() {
        var service = service("", Map.of());
        assertEquals(24, service.httpGrizzlyWorkerThreadsPoolSize());
        assertEquals(Duration.ofMinutes(20), service.auditStuckRunTimeout());
        assertEquals(Duration.ofMinutes(1), service.auditStuckCheckInterval());
        assertEquals(3, service.auditMaxAttempts());
        assertFalse(service.codexSummaryEnabled());
        assertEquals("http://codex-summary:3010", service.codexSummaryServiceUrl());
        assertEquals(Duration.ofSeconds(45), service.codexSummaryTimeout());
        assertThrows(ConfigException.Missing.class, service::auditSchedulerInterval);
        assertThrows(ConfigException.Missing.class, service::internalApiAuthUsername);
        assertThrows(IllegalStateException.class, service::internalApiAuthPassword);
    }
    @Test void explicitHoconAndEnvironmentSettingsOverrideDefaults() {
        var service = service("""
            internal-api.auth-username = "test-user"
            internal-api.auth-password = "synthetic-test-value"
            http-grizzly.worker-threads-pool-size = 16
            audit.scheduler.interval = 2s
            audit.scheduler.stuck-timeout = 30m
            audit.scheduler.stuck-check-interval = 90s
            audit.scheduler.max-attempts = 5
            """, Map.of("CODEX_SUMMARY_ENABLED", "true", "CODEX_SUMMARY_SERVICE_URL", "http://fixture:3010",
                "CODEX_SUMMARY_TIMEOUT_SECONDS", "60"));
        assertEquals("test-user", service.internalApiAuthUsername());
        assertEquals("synthetic-test-value", service.internalApiAuthPassword());
        assertEquals(16, service.httpGrizzlyWorkerThreadsPoolSize());
        assertEquals(Duration.ofSeconds(2), service.auditSchedulerInterval());
        assertEquals(Duration.ofMinutes(30), service.auditStuckRunTimeout());
        assertEquals(Duration.ofSeconds(90), service.auditStuckCheckInterval());
        assertEquals(5, service.auditMaxAttempts());
        assertTrue(service.codexSummaryEnabled());
        assertEquals("http://fixture:3010", service.codexSummaryServiceUrl());
        assertEquals(Duration.ofSeconds(60), service.codexSummaryTimeout());
    }
    @Test void invalidTypedHoconDoesNotSilentlyBecomeADefault() {
        var service = service("""
            http-grizzly.worker-threads-pool-size = "invalid"
            audit.scheduler.interval = "invalid"
            audit.scheduler.stuck-timeout = "invalid"
            audit.scheduler.stuck-check-interval = "invalid"
            audit.scheduler.max-attempts = "invalid"
            """, Map.of());
        assertThrows(ConfigException.class, service::httpGrizzlyWorkerThreadsPoolSize);
        assertThrows(ConfigException.class, service::auditSchedulerInterval);
        assertThrows(ConfigException.class, service::auditStuckRunTimeout);
        assertThrows(ConfigException.class, service::auditStuckCheckInterval);
        assertThrows(ConfigException.class, service::auditMaxAttempts);
    }
    @ParameterizedTest @ValueSource(strings = {"invalid", "", "9223372036854775808"})
    void invalidSummaryTimeoutFallsBackTo45Seconds(String value) {
        assertEquals(Duration.ofSeconds(45), service("", Map.of("CODEX_SUMMARY_TIMEOUT_SECONDS", value)).codexSummaryTimeout());
    }
    @ParameterizedTest @ValueSource(strings = {"-1", "0", "4", "5"})
    void summaryTimeoutHasAMinimumOfFiveSeconds(String value) {
        assertEquals(Duration.ofSeconds(5), service("", Map.of("CODEX_SUMMARY_TIMEOUT_SECONDS", value)).codexSummaryTimeout());
    }

    @Test void externalSettingsPreferHoconThenEnvironmentThenDefaults() {
        var fallback = service("", Map.of());
        assertEquals("http://playwright-service:3016", fallback.playwrightServiceUrl());
        assertEquals(Duration.ofSeconds(60), fallback.lighthouseTimeout());
        assertEquals("http://zap:8080", fallback.zapApiUrl());
        assertEquals("https://api.ssllabs.com/api/v3", fallback.sslLabsApiUrl());
        var legacy = service("", Map.of("PLAYWRIGHT_SERVICE_URL", "http://legacy:3016/",
            "LIGHTHOUSE_TIMEOUT_SECONDS", "75", "ZAP_API_KEY", "legacy-key"));
        assertEquals("http://legacy:3016", legacy.playwrightServiceUrl());
        assertEquals(Duration.ofSeconds(75), legacy.lighthouseTimeout());
        assertEquals("legacy-key", legacy.zapApiKey());
        var hocon = service("""
            external.playwright.url = "http://configured:3016"
            external.lighthouse.timeout = 80s
            external.zap.api-key = "configured-key"
            """, Map.of("PLAYWRIGHT_SERVICE_URL", "http://legacy:3016",
                "LIGHTHOUSE_TIMEOUT_SECONDS", "75", "ZAP_API_KEY", "legacy-key"));
        assertEquals("http://configured:3016", hocon.playwrightServiceUrl());
        assertEquals(Duration.ofSeconds(80), hocon.lighthouseTimeout());
        assertEquals("configured-key", hocon.zapApiKey());
    }

    @Test void invalidExternalSettingsFailWithoutEchoingValues() {
        var badUrl = service("", Map.of("ZAP_API_URL", "synthetic-secret"));
        var urlError = assertThrows(IllegalArgumentException.class, badUrl::zapApiUrl);
        assertFalse(urlError.getMessage().contains("synthetic-secret"));
        assertThrows(IllegalArgumentException.class,
            () -> service("", Map.of("LIGHTHOUSE_TIMEOUT_SECONDS", "invalid")).lighthouseTimeout());
        assertThrows(IllegalArgumentException.class,
            () -> service("external.playwright.timeout = -1s", Map.of()).playwrightTimeout());
    }
    @Test void workerPoolDefaultsAreBoundedAndLegacyMaximumRemainsSupported() {
        var pool = service("", Map.of()).httpGrizzlyWorkerThreadPoolConfig();
        assertEquals(4, pool.getCorePoolSize());
        assertEquals(24, pool.getMaxPoolSize());
        assertEquals(64, pool.getQueueLimit());
        var legacy = service("http-grizzly.worker-threads-pool-size=2", Map.of()).httpGrizzlyWorkerThreadPoolConfig();
        assertEquals(2, legacy.getCorePoolSize());
        assertEquals(2, legacy.getMaxPoolSize());
        var configured = service("""
            http-grizzly.worker-threads-pool-size=8
            http-grizzly.worker-threads-core-pool-size=2
            http-grizzly.worker-threads-queue-limit=12
            """, Map.of()).httpGrizzlyWorkerThreadPoolConfig();
        assertEquals(2, configured.getCorePoolSize());
        assertEquals(8, configured.getMaxPoolSize());
        assertEquals(12, configured.getQueueLimit());
    }

    @ParameterizedTest @ValueSource(strings = {
        "http-grizzly.worker-threads-pool-size=0",
        "http-grizzly.worker-threads-core-pool-size=-1",
        "http-grizzly.worker-threads-queue-limit=-1",
        "http-grizzly.worker-threads-pool-size=2\nhttp-grizzly.worker-threads-core-pool-size=3",
        "db.hikari.maximumPoolSize=0", "db.hikari.minimumIdle=-1",
        "db.hikari.maximumPoolSize=2\ndb.hikari.minimumIdle=3",
        "db.hikari.connectionTimeout=0", "db.hikari.connectionTimeout=249",
        "db.hikari.maximumPoolSize=null", "db.hikari.minimumIdle=null", "db.hikari.connectionTimeout=null"
    })
    void invalidPoolSettingsFailBeforeStartup(String config) {
        assertThrows(IllegalArgumentException.class, () -> service(config, Map.of()).validateResourcePools());
    }

}
