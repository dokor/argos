package com.dokor.argos.services.ci;

import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.google.common.net.InternetDomainName;
import java.net.URI;
import java.util.*;

/** Exact HTTPS origins only. No wildcard, IP, parent-domain or implicit www authorization. */
public final class CiOrigin {
    public static final int MAX_ORIGINS = 100;
    private CiOrigin() {}
    public static String parse(String input) {
        String normalized = UrlNormalizer.normalizeSyntax(input);
        var uri = URI.create(normalized);
        if (!"https".equals(uri.getScheme()) || uri.getRawQuery() != null || uri.getRawFragment() != null
                || uri.getPath() != null && !uri.getPath().isEmpty()) throw new IllegalArgumentException("CI origin invalid");
        var domain = InternetDomainName.from(uri.getHost());
        if (!domain.hasPublicSuffix() || domain.isPublicSuffix()) throw new IllegalArgumentException("CI hostname invalid");
        // A fragment is not preserved by the audit normalizer. Reject it explicitly here.
        if (URI.create(input).getRawFragment() != null) throw new IllegalArgumentException("CI origin invalid");
        return normalized;
    }
    public static String ofUrl(String input) {
        var uri = URI.create(UrlNormalizer.normalizeSyntax(input));
        return parse(uri.getScheme() + "://" + uri.getHost());
    }
    public static List<String> scope(List<String> origins) {
        if (origins == null || origins.isEmpty() || origins.size() > MAX_ORIGINS)
            throw new IllegalArgumentException("CI scope invalid");
        var values = origins.stream().map(CiOrigin::parse).toList();
        if (new HashSet<>(values).size() != values.size()) throw new IllegalArgumentException("CI scope invalid");
        return List.copyOf(values);
    }
    public static void require(List<String> origins, String url) {
        if (!scope(origins).contains(ofUrl(url))) throw new IllegalArgumentException("CI destination not authorized");
    }
}
