package com.dokor.argos.services.analysis;

import com.dokor.argos.services.configuration.ConfigurationService;
import jakarta.inject.*;
import java.net.URI;
import java.time.Instant;
import java.util.*;

/** Process-local bounded monitoring. Restart resets counters; no target, credential or response retained. */
@Singleton
public final class CollectorDiagnostics {
    public record Status(String module, boolean enabled, String endpoint, String state,
                         String failureCode, long completed, long failed, String observedAt) {}
    private final Map<String, Status> statuses = new LinkedHashMap<>();
    @Inject public CollectorDiagnostics(ConfigurationService config) {
        boolean enabled = "true".equals(System.getenv("ARGOS_EXTERNAL_SCANS_ENABLED"));
        register("ssl", config.sslLabsApiUrl(), enabled);
        register("observatory", config.observatoryApiUrl(), enabled);
    }
    private void register(String module, String endpoint, boolean enabled) {
        URI uri = URI.create(endpoint);
        // Configured endpoint authority/path only, never any user target or query.
        String safe = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() < 0 ? "" : ":" + uri.getPort()) + uri.getPath();
        statuses.put(module, new Status(module, enabled, safe, enabled ? "NOT_OBSERVED" : "DISABLED",
            enabled ? null : "POLICY_DISABLED", 0, 0, null));
    }
    public synchronized void record(String module, boolean complete, Throwable error) {
        Status before = statuses.get(module);
        if (before == null) return;
        statuses.put(module, new Status(module, before.enabled(), before.endpoint(), complete ? "COMPLETED" : "UNAVAILABLE",
            complete ? null : CollectorFailure.classify(error).name(), before.completed() + (complete ? 1 : 0),
            before.failed() + (complete ? 0 : 1), Instant.now().toString()));
    }
    public synchronized List<Status> snapshot() { return List.copyOf(statuses.values()); }
}
