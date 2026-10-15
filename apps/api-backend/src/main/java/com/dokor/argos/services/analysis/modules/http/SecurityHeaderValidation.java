package com.dokor.argos.services.analysis.modules.http;

import java.util.*;

/** Conservative configuration checks, not a proof that a site is free of XSS. */
final class SecurityHeaderValidation {
    private SecurityHeaderValidation() {}
    static boolean effective(String name, String value, Map<String, String> headers) {
        if (name.equals("x-frame-options") && restrictedSources(headers.get("content-security-policy"), "frame-ancestors")) return true;
        if (value == null || value.isBlank()) return false;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (name) {
            case "strict-transport-security" -> positiveMaxAge(normalized);
            case "x-content-type-options" -> normalized.equals("nosniff");
            case "x-frame-options" -> Set.of("deny", "sameorigin").contains(normalized);
            case "referrer-policy" -> {
                String selected = "";
                for (String token : normalized.split(","))
                    if (Set.of("no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin",
                        "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url").contains(token.trim())) selected = token.trim();
                yield !selected.isEmpty() && !selected.equals("unsafe-url");
            }
            case "content-security-policy" -> restrictedSources(value, "script-src")
                || (!hasDirective(value, "script-src") && restrictedSources(value, "default-src"));
            // Require at least one recognized capability with a restrictive allowlist.
            case "permissions-policy" -> Arrays.stream(normalized.split(",")).anyMatch(d ->
                d.trim().matches("(camera|microphone|geolocation|payment|usb|fullscreen|autoplay|display-capture)\\s*=\\s*\\((self|\\\"https://[a-z0-9.:-]+\\\")?(\\s+\\\"https://[a-z0-9.:-]+\\\")*\\)"));
            default -> false;
        };
    }
    private static boolean positiveMaxAge(String value) {
        String age = null;
        for (String directive : value.split(";")) {
            if (!directive.trim().matches("max-age(?:\\s*=.*)?")) continue;
            if (age != null || !directive.trim().matches("max-age\\s*=\\s*\\\"?[0-9]+\\\"?")) return false;
            age = directive.substring(directive.indexOf('=') + 1).trim();
            if (age.startsWith("\"") != age.endsWith("\"")) return false;
            age = age.replace("\"", "");
        }
        return age != null && age.matches("[0-9]*[1-9][0-9]*");
    }
    private static boolean hasDirective(String policy, String name) { return sources(policy, name) != null; }
    private static String sources(String policy, String name) {
        if (policy == null) return null;
        // Comma-joined policies need independent evaluation; do not certify them here.
        if (policy.contains(",")) return "";
        for (String directive : policy.split(";")) {
            String[] parts = directive.trim().split("\\s+", 2);
            if (parts[0].equalsIgnoreCase(name)) return parts.length == 2 ? parts[1] : "";
        }
        return null;
    }
    private static boolean restrictedSources(String policy, String name) {
        String sources = sources(policy, name);
        if (sources == null || sources.isBlank()) return false;
        if (sources.equals("'none'")) return true;
        return Arrays.stream(sources.split("\\s+")).allMatch(token -> token.equals("'self'")
            || (!name.equals("frame-ancestors") && (token.matches("'nonce-[A-Za-z0-9+/_-]+=*'") || token.matches("'sha(256|384|512)-[A-Za-z0-9+/_-]+=*'")))
            || token.matches("https://[A-Za-z0-9.-]+(?::[0-9]+)?(?:/[^\\s;]*)?"));
    }
}
