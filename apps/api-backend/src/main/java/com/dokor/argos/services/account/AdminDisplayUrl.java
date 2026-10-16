package com.dokor.argos.services.account;

import java.net.URI;
import java.util.Locale;

/** Restricted list projection. Raw URLs never leave the administration service. */
public final class AdminDisplayUrl {
    private AdminDisplayUrl() {}

    public static String host(String value) {
        if (value == null) return null;
        String host = value.toLowerCase(Locale.ROOT);
        if (!host.matches("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z][a-z0-9-]{1,62}")
                || host.matches("(?:.*\\.)?(localhost|local|internal|localdomain|test|invalid|example|onion)")) return null;
        return host;
    }

    public static String project(String value, String expectedHost) {
        try {
            URI uri = URI.create(value);
            String host = host(uri.getHost());
            if (host == null || !host.equals(host(expectedHost))
                    || !("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getRawUserInfo() != null || uri.getPort() != -1) return null;
            String path = uri.normalize().getRawPath();
            if (path == null || path.isEmpty()) path = "/";
            // Opaque identifiers and token-bearing routes are intentionally hidden.
            if (path.matches("(?i).*(?:/report/|/shared-reports/|/reset/|/verify/|/oauth/).*")) path = "/…";
            else path = path.replaceAll("[A-Za-z0-9_%=-]{24,}", "…");
            return uri.getScheme().toLowerCase(Locale.ROOT) + "://" + host + path;
        } catch (RuntimeException ignored) { return null; }
    }
}
