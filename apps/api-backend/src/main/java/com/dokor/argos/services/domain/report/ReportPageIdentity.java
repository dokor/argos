package com.dokor.argos.services.domain.report;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Display identity only. Never use a redacted URL as an exact replay target. */
public record ReportPageIdentity(String requested, String destination, boolean redacted, boolean redirected) {
    public static ReportPageIdentity from(String requested, String destination) {
        String safeRequested = display(requested), safeDestination = display(destination);
        return new ReportPageIdentity(safeRequested, safeDestination,
            !java.util.Objects.equals(requested, safeRequested)
                || destination != null && !java.util.Objects.equals(destination, safeDestination),
            destination != null && !java.util.Objects.equals(requested, destination));
    }

    static String display(String value) {
        if (value == null) return null;
        try {
            URI uri = URI.create(value);
            if (value.length() > 2048 || uri.getHost() == null
                || !java.util.Set.of("http", "https").contains(uri.getScheme().toLowerCase(Locale.ROOT))) return null;
            StringBuilder path = new StringBuilder();
            boolean hideNext = false;
            String[] segments = uri.getRawPath().split("/", -1);
            for (int index = 0; index < segments.length; index++) {
                String segment = segments[index];
                String decoded = URLDecoder.decode(segment, StandardCharsets.UTF_8);
                boolean sensitive = hideNext || decoded.length() > 64
                    || decoded.matches("(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9_=-]{24,}") || decoded.contains("@")
                    || decoded.matches("(?i).*(token|password|secret|api[_-]?key|session)[=:].*")
                    || decoded.codePoints().anyMatch(c -> Character.isISOControl(c) || c >= 0x202a && c <= 0x202e || c >= 0x2066 && c <= 0x2069);
                if (index > 0) path.append('/');
                path.append(sensitive ? "~redacted~" : segment);
                hideNext = decoded.matches("(?i)(report|reset-password|reset|token|invite|verify|session|secret)");
            }
            String rawPath = uri.getRawPath();
            String displayedPath = path.toString();
            if (rawPath.startsWith("/") && !displayedPath.startsWith("/")) displayedPath = "/" + displayedPath;
            return uri.getScheme().toLowerCase(Locale.ROOT) + "://" + uri.getHost().toLowerCase(Locale.ROOT)
                + (uri.getPort() == -1 ? "" : ":" + uri.getPort()) + displayedPath;
        } catch (Exception invalid) { return null; }
    }
}
