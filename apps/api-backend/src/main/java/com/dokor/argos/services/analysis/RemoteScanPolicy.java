package com.dokor.argos.services.analysis;

import com.dokor.argos.services.domain.audit.UrlNormalizer;
import java.util.Locale;
import java.util.function.Consumer;

/** Public hostname admission for trusted remote providers, not a remote DNS-pinning guarantee. */
public final class RemoteScanPolicy {
    private RemoteScanPolicy() {}

    public static String requireAllowed(String host, boolean enabled) {
        return requireAllowed(host, enabled, UrlNormalizer::validatePublicUrl);
    }

    static String requireAllowed(String host, boolean enabled, Consumer<String> validatePublicUrl) {
        if (!enabled) throw new CollectorFailure(CollectorFailure.Code.POLICY_DISABLED);
        // Send only an ASCII DNS name: no IP, port, user info, path, query, fragment or trailing dot.
        if (host == null || host.length() > 253)
            throw new IllegalArgumentException("Invalid scan hostname");
        String canonical = host.toLowerCase(Locale.ROOT);
        if (!canonical.matches("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z][a-z0-9-]{1,62}"))
            throw new IllegalArgumentException("Invalid scan hostname");
        // Reject reserved names and every non-public A/AAAA answer, including mixed DNS.
        // This does not pin connections made independently by the provider.
        validatePublicUrl.accept("https://" + canonical);
        return canonical;
    }
}
