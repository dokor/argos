package com.dokor.argos.services.connected.discovery;

import java.time.Duration;
import java.util.function.BooleanSupplier;

public final class DiscoveryBudget {
    private final long end;
    private final BooleanSupplier canceled;

    public DiscoveryBudget(Duration duration, BooleanSupplier canceled) {
        end = System.nanoTime() + duration.toNanos();
        this.canceled = canceled;
    }

    public DiscoveryBudget restrict(Duration maximum) {
        return new DiscoveryBudget(maximum, () -> { check(); return false; });
    }

    public void check() {
        if (Thread.currentThread().isInterrupted() || canceled.getAsBoolean())
            throw new DiscoveryStop("CANCELED");
        if (System.nanoTime() >= end) throw new DiscoveryStop("TIME_LIMIT");
    }

    public long remainingMillis() {
        check();
        return Math.max(1, Duration.ofNanos(end - System.nanoTime()).toMillis());
    }
}
