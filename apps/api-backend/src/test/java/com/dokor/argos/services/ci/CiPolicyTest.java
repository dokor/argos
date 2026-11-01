package com.dokor.argos.services.ci;

import com.typesafe.config.ConfigFactory;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CiPolicyTest {
    @Test void defaultsAreClosedAndCommercialLimitsAreExplicit() {
        assertTrue(new CiPolicy(ConfigFactory.empty()).limits().isEmpty());
        var config = ConfigFactory.load();
        assertTrue(new CiPolicy(config).limits().isEmpty());
        var enabled = ConfigFactory.parseString("premium-ci.enabled=true").withFallback(config);
        var limits = new CiPolicy(enabled).limits().orElseThrow();
        assertEquals(30, limits.monthlyAnalysesPerKey());
        assertEquals(3, limits.activeKeys());
        assertTrue(limits.verifiedTargets().isEmpty());
        assertEquals(1, limits.concurrentRuns());
        assertEquals(Instant.parse("2027-10-18T12:00:00Z"),
            limits.keyExpiresAt(Instant.parse("2026-10-18T12:00:00Z")));
        assertEquals(Instant.parse("2029-02-28T12:00:00Z"),
            limits.keyExpiresAt(Instant.parse("2028-02-29T12:00:00Z")));
    }

    @Test void enablingWithoutAnExplicitMatrixFails() {
        assertThrows(Exception.class, () -> new CiPolicy(ConfigFactory.parseString("premium-ci.enabled=true")));
        var base = ConfigFactory.load();
        for (String key : new String[]{"monthly-analyses-per-key", "max-active-keys",
                "max-concurrent-runs", "max-key-lifetime-years"}) {
            for (String invalid : new String[]{"null", "0", "-1", "1.5", "2147483648", "unlimited"}) {
                var config = ConfigFactory.parseString("premium-ci.enabled=true\npremium-ci." + key + "=" + invalid).withFallback(base);
                assertThrows(Exception.class, () -> new CiPolicy(config), key + "=" + invalid);
            }
        }
        var noTargets = base.withoutPath("premium-ci.max-verified-targets");
        assertThrows(Exception.class, () -> new CiPolicy(
            ConfigFactory.parseString("premium-ci.enabled=true").withFallback(noTargets)));
        assertThrows(Exception.class, () -> new CiPolicy(ConfigFactory.parseString(
            "premium-ci.enabled=true\npremium-ci.max-verified-targets=0").withFallback(base)));
    }
}
