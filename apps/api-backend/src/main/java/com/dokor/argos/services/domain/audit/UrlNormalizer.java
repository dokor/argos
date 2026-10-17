package com.dokor.argos.services.domain.audit;

import com.google.common.net.InetAddresses;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.net.*;
import java.util.Locale;

/** Shared audit URL policy. DNS checks at admission are repeated by the pinned egress proxy. */
@Singleton
public class UrlNormalizer {
    static final int MAX_URL_LENGTH = 2048;
    @FunctionalInterface interface Resolver { InetAddress[] resolve(String host) throws Exception; }
    private final Resolver resolver;
    @Inject public UrlNormalizer() { this(InetAddress::getAllByName); }
    UrlNormalizer(Resolver resolver) { this.resolver = resolver; }

    public String normalize(String input) {
        if (input == null || input.isBlank()) throw new IllegalArgumentException("URL cannot be blank");
        String value = input.strip();
        if (!value.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) value = "https://" + value;
        URI uri = parse(value);
        validateHost(uri.getHost(), resolver);
        return canonical(uri);
    }

    /** Absolute discovery/transport syntax only. DNS validation remains mandatory before a fetch. */
    public static String normalizeSyntax(String input) { return canonical(parse(input)); }

    /** Deterministic admission fingerprint, including the existing default HTTPS input convention. */
    public static String normalizeAdmissionSyntax(String input) {
        if (input == null || input.isBlank()) throw new IllegalArgumentException("URL cannot be blank");
        String value = input.strip();
        if (!value.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) value = "https://" + value;
        return canonical(parse(value));
    }

    private static String canonical(URI uri) {
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        String path = uri.normalize().getRawPath();
        return scheme + "://" + host + (path == null || path.equals("/") ? "" : path)
            + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
    }

    public String extractHostname(String normalized) { return URI.create(normalized).getHost(); }

    private static URI parse(String value) {
        if (value.length() > MAX_URL_LENGTH || value.matches("(?s).*[\\s\\\\\\x00-\\x1f\\x7f].*"))
            throw new IllegalArgumentException("Invalid URL format or length");
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) throw new IllegalArgumentException("Only HTTP(S) URLs are allowed");
            if (uri.getRawUserInfo() != null) throw new IllegalArgumentException("URL credentials are not allowed");
            if (uri.getHost() == null || uri.getHost().endsWith(".") || uri.getHost().contains("%"))
                throw new IllegalArgumentException("Invalid URL host");
            int port = uri.getPort();
            if (port != -1 && port != (scheme.equals("http") ? 80 : 443))
                throw new IllegalArgumentException("Only default HTTP(S) ports are allowed");
            // Reject empty ports and numeric shorthand that different URL parsers interpret differently.
            String expected = uri.getHost() + (port == -1 ? "" : ":" + port);
            if (!expected.equalsIgnoreCase(uri.getRawAuthority())) throw new IllegalArgumentException("Ambiguous URL authority");
            validateHostSyntax(uri.getHost());
            return uri;
        } catch (URISyntaxException e) { throw new IllegalArgumentException("Malformed URL"); }
    }

    public static void validatePublicUrl(String value) {
        URI uri = parse(value);
        validateHost(uri.getHost(), InetAddress::getAllByName);
    }

    private static String validateHostSyntax(String bracketed) {
        String host = bracketed.replace("[", "").replace("]", "").toLowerCase(Locale.ROOT);
        if (InetAddresses.isInetAddress(host)) {
            InetAddress address = InetAddresses.forString(host);
            if (host.contains(":") && address.getAddress().length != 16 || isBlockedAddress(address)) throw new IllegalArgumentException("Target is not public");
            return host;
        }
        if (host.length() > 253 || !host.matches("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z][a-z0-9-]{1,62}")
            || host.matches("(?:.*\\.)?(localhost|local|internal|localdomain|test|invalid|example|onion)"))
            throw new IllegalArgumentException("Target hostname is not allowed");
        return host;
    }

    private static void validateHost(String bracketed, Resolver resolver) {
        String host = validateHostSyntax(bracketed);
        if (InetAddresses.isInetAddress(host)) return;
        try {
            InetAddress[] answers = resolver.resolve(host);
            if (answers.length == 0) throw new IllegalArgumentException("Target DNS unavailable");
            for (InetAddress answer : answers) if (isBlockedAddress(answer)) throw new IllegalArgumentException("Target is not public");
        } catch (IllegalArgumentException e) { throw e; }
        catch (Exception e) { throw new IllegalArgumentException("Target DNS unavailable"); }
    }

    static boolean isBlockedAddress(InetAddress address) {
        byte[] b = address.getAddress();
        int a = b[0] & 255, c = b[1] & 255;
        if (b.length == 4) {
            int d = b[2] & 255;
            return a == 0 || a == 10 || a == 127 || a >= 224
                || a == 100 && c >= 64 && c <= 127 || a == 169 && c == 254
                || a == 172 && c >= 16 && c <= 31
                || a == 192 && (c == 168 || c == 0 && (d == 0 || d == 2) || c == 88 && d == 99)
                || a == 198 && (c == 18 || c == 19 || c == 51 && d == 100)
                || a == 203 && c == 0 && d == 113;
        }
        // Only global unicast 2000::/3; exclude special-use, documentation and 6to4.
        int d = b[2] & 255, e = b[3] & 255;
        return (a & 0xe0) != 0x20 || a == 0x20 && c == 1 && (d < 2 || d == 0x0d && e == 0xb8)
            || a == 0x20 && c == 2 || a == 0x3f && c == 0xff && (d & 0xf0) == 0;
    }

    /** Untrusted paths, credentials, queries and fragments never enter logs. */
    public static String sanitizeForLog(String value) {
        if (value == null) return "null";
        try {
            URI uri = parse(value);
            return uri.getScheme().toLowerCase(Locale.ROOT) + "://" + uri.getHost().toLowerCase(Locale.ROOT);
        } catch (Exception ignored) { return "[invalid URL]"; }
    }
}
