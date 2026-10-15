package com.dokor.argos.services.analysis;

import com.dokor.argos.services.domain.audit.UrlNormalizer;

/** External scanners resolve/connect independently: disabled until their controls are reviewed. */
public final class RemoteScanPolicy {
    private RemoteScanPolicy() {}
    public static void requireAllowed(String host) {
        requireAllowed(host, "true".equals(System.getenv("ARGOS_EXTERNAL_SCANS_ENABLED")));
    }
    public static void requireAllowed(String host, boolean enabled) {
        if (!enabled)
            throw new CollectorFailure(CollectorFailure.Code.POLICY_DISABLED);
        if (host == null || host.contains("/") || host.contains("@") || host.contains("?") || host.contains("#"))
            throw new IllegalArgumentException("Invalid scan hostname");
        UrlNormalizer.validatePublicUrl("https://" + host);
    }
}
