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
    @Test void optionalSettingsHaveDefaultsAndRequiredSettingsRemainRequired() {
        var service = service("", Map.of());
        assertNull(service.httpGrizzlyWorkerThreadsPoolSize());
        assertEquals(Duration.ofMinutes(20), service.auditStuckRunTimeout());
        assertEquals(Duration.ofMinutes(1), service.auditStuckCheckInterval());
        assertEquals(3, service.auditMaxAttempts());
        assertFalse(service.codexSummaryEnabled());
        assertEquals("http://codex-summary:3010", service.codexSummaryServiceUrl());
        assertEquals(Duration.ofSeconds(45), service.codexSummaryTimeout());
        assertThrows(ConfigException.Missing.class, service::auditSchedulerInterval);
        assertThrows(ConfigException.Missing.class, service::internalApiAuthUsername);
        assertThrows(ConfigException.Missing.class, service::internalApiAuthPassword);
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
}
