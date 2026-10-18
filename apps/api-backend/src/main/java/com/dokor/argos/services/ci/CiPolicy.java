package com.dokor.argos.services.ci;

import com.typesafe.config.Config;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.OptionalInt;

/** Commercial values must be supplied explicitly before enabling new CI operations. */
@Singleton
public final class CiPolicy {
    public record Limits(int monthlyAnalysesPerKey, int activeKeys, OptionalInt verifiedTargets,
                         int concurrentRuns, int keyLifetimeYears) {
        /** Calendar year in UTC, including leap-day adjustment by java.time. */
        public Instant keyExpiresAt(Instant createdAt) {
            return createdAt.atZone(ZoneOffset.UTC).plusYears(keyLifetimeYears).toInstant();
        }
    }
    private final Optional<Limits> limits;

    @Inject public CiPolicy(Config config) {
        if (!config.hasPath("premium-ci.enabled") || !config.getBoolean("premium-ci.enabled")) {
            limits = Optional.empty();
            return;
        }
        var ci = config.getConfig("premium-ci");
        if (!ci.hasPathOrNull("max-verified-targets"))
            throw new IllegalArgumentException("CI target limit must be explicit (null for unlimited)");
        var targets = ci.getIsNull("max-verified-targets") ? OptionalInt.empty()
            : OptionalInt.of(positive(ci, "max-verified-targets"));
        limits = Optional.of(new Limits(positive(ci, "monthly-analyses-per-key"),
            positive(ci, "max-active-keys"), targets, positive(ci, "max-concurrent-runs"),
            positive(ci, "max-key-lifetime-years")));
    }

    private static int positive(Config config, String path) {
        int value = config.getInt(path);
        if (value < 1 || config.getDouble(path) != value)
            throw new IllegalArgumentException("Invalid CI limit: " + path);
        return value;
    }

    public Optional<Limits> limits() { return limits; }
}
