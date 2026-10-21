package com.dokor.argos.services.connected.discovery;

import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.typesafe.config.Config;

import jakarta.inject.*;

/** Operator bounds; client parameters can only reduce them. */
@Singleton
public final class DiscoveryPolicy {
    public final int maxUrls,
            maxDepth,
            seconds,
            perHost,
            workers,
            queueLimit,
            accountQueueLimit,
            maxRequests,
            redirects,
            bodyBytes,
            robotsBytes,
            connectSeconds,
            responseSeconds,
            maxLinks,
            maxSitemaps;

    @Inject
    public DiscoveryPolicy(Config c) {
        maxUrls = value(c, "max-urls", 500, 1, 1000);
        maxDepth = value(c, "max-depth", 5, 0, 10);
        seconds = value(c, "duration-seconds", 60, 1, 300);
        perHost = value(c, "requests-per-host", 2, 1, 2);
        workers = value(c, "workers", 4, 1, 16);
        queueLimit = value(c, "queue-limit", 100, 1, 1000);
        accountQueueLimit = value(c, "account-queue-limit", 5, 1, 50);
        maxRequests = value(c, "max-requests", 1000, 1, 10000);
        redirects = value(c, "max-redirects", 5, 0, 5);
        bodyBytes = value(c, "body-bytes", 2097152, 1024, 2097152);
        robotsBytes = value(c, "robots-bytes", 1048576, 1024, 1048576);
        connectSeconds = value(c, "connect-seconds", 5, 1, 10);
        responseSeconds = value(c, "response-seconds", 10, 1, 30);
        maxLinks = value(c, "max-links", 1000, 1, 5000);
        maxSitemaps = value(c, "max-sitemaps", 5, 1, 20);
    }

    private static int value(Config c, String name, int fallback, int min, int max) {
        String key = "discovery." + name;
        int v = c.hasPath(key) ? c.getInt(key) : fallback;
        if (v < min || v > max || (c.hasPath(key) && c.getDouble(key) != v))
            throw new IllegalArgumentException("Invalid discovery configuration: " + name);
        return v;
    }

    public void validate(CreateDiscovery input, String offer) {
        var allowed = capabilities(offer);
        if (input.maxUrls() > allowed.maxUrls() || input.maxDepth() > allowed.maxDepth())
            throw new com.dokor.argos.services.account.AccountError(400, "discovery_limits_invalid");
    }

    // A queued snapshot never grows; reduced operator limits apply when execution starts.
    public DiscoveryLimits restrict(DiscoveryLimits saved) {
        return new DiscoveryLimits(Math.min(saved.maxUrls(), maxUrls),
                Math.min(saved.maxDepth(), maxDepth), Math.min(saved.durationSeconds(), seconds),
                Math.min(saved.requestsPerHost(), perHost));
    }

    public DiscoveryCapabilities capabilities(String offer) {
        boolean premium = "PREMIUM".equals(offer);
        long urls = Math.min(maxUrls, premium ? 500 : 50);
        long depth = Math.min(maxDepth, premium ? 5 : 3);
        return new DiscoveryCapabilities(urls, depth, premium ? urls : Math.min(20, urls),
                premium ? depth : Math.min(2, depth), (long) seconds);
    }

    public DiscoveryLimits limits(CreateDiscovery input, String offer) {
        var allowed = capabilities(offer);
        return new DiscoveryLimits(Math.min(input.maxUrls(), allowed.maxUrls()),
                Math.min(input.maxDepth(), allowed.maxDepth()), (long) seconds, (long) perHost);
    }

    public DiscoveryLimits limits(CreateDiscovery input) {
        return new DiscoveryLimits(
                Math.min(input.maxUrls(), maxUrls),
                Math.min(input.maxDepth(), maxDepth),
                (long) seconds,
                (long) perHost);
    }
}
