package com.dokor.argos.util;

import java.net.URI;

/** URI parsing only: no normalization, DNS lookup or SSRF validation. */
public final class Urls {
    private Urls() {}

    public static String host(String url) {
        return host(url, null);
    }

    /**
     * Returns URI.getHost() unchanged (including IPv6 brackets and host case).
     * A valid URI without a host returns null. Only malformed input uses the
     * fallback; report composition historically keeps that input as its domain.
     */
    public static String host(String url, String invalidFallback) {
        if (url == null) return invalidFallback;
        try {
            return URI.create(url).getHost();
        } catch (IllegalArgumentException e) {
            return invalidFallback;
        }
    }
}
