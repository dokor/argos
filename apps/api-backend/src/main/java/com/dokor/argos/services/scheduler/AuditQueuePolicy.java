package com.dokor.argos.services.scheduler;

import com.typesafe.config.Config;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

/** Optional relative priority; aging protects older requests and never changes admission. */
@Singleton
public final class AuditQueuePolicy {
    public final boolean premiumPriorityEnabled;
    public final int agingSeconds;

    @Inject public AuditQueuePolicy(Config config) {
        String prefix = "audit.queue.";
        premiumPriorityEnabled = config.hasPath(prefix + "premium-priority-enabled")
            && config.getBoolean(prefix + "premium-priority-enabled");
        agingSeconds = config.hasPath(prefix + "priority-aging-seconds")
            ? config.getInt(prefix + "priority-aging-seconds") : 120;
        if (agingSeconds < 10 || agingSeconds > 3600
                || config.hasPath(prefix + "priority-aging-seconds")
                    && config.getDouble(prefix + "priority-aging-seconds") != agingSeconds)
            throw new IllegalArgumentException("Invalid audit queue aging configuration");
    }
}
