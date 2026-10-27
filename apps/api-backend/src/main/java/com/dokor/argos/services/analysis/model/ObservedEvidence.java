package com.dokor.argos.services.analysis.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.util.*;
import java.util.function.Predicate;

/** Allowlisted observations; arbitrary detail strings never become resource/DOM evidence. */
public record ObservedEvidence(
        String version,
        String source,
        String state,
        List<Item> items,
        int inspected,
        boolean truncated,
        boolean redacted) {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> TYPES =
            Set.of(
                    "document",
                    "stylesheet",
                    "image",
                    "media",
                    "font",
                    "script",
                    "xhr",
                    "fetch",
                    "other");

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Item(
            String kind,
            String origin,
            String resourceRef,
            String nodePath,
            Integer status,
            String reason,
            String resourceType,
            String ownership,
            String resourcePath,
            String selector,
            Map<String, Double> metrics,
            String locationScope,
            List<String> attributes) {
        public Item(String kind, String origin, String resourceRef, String nodePath, Integer status,
                    String reason, String resourceType, String ownership) {
            this(kind,origin,resourceRef,nodePath,status,reason,resourceType,ownership,null,null,null,null,null);
        }
    }

    private static final Set<String> METRICS = Set.of("totalBytes", "wastedBytes", "wastedMs",
        "transferSize", "resourceSize", "duration", "width", "height", "navStartToEndTime", "startTime", "sourceLine", "sourceColumn", "reflowTime", "mainThreadTime", "layoutShiftScore", "navigationStep");
    public static String safeResourcePath(String path) {
        if ("/".equals(path) || "/robots.txt".equals(path)) return path;
        if (path == null || path.length() > 1024 || !path.startsWith("/") || path.startsWith("//")
            || !path.matches("/[a-zA-Z0-9/_.~!$&()+,;=% -]+")) return null;
        try {
            String decoded = java.net.URLDecoder.decode(path, java.nio.charset.StandardCharsets.UTF_8);
            if (decoded.chars().anyMatch(c -> c < 32 || c == 127 || c == 92 || "%?#@<>".indexOf(c) >= 0)
                || decoded.matches("(?i).*(token|secret|password|passwd|session|authorization|api[_-]?key|private|customer|email).*")) return null;
            for (String segment : decoded.split("/")) if (segment.equals(".") || segment.equals("..") || segment.length() > 100 || segment.matches(".*[0-9]{7,}.*")) return null;
            return decoded.matches("(?i).*\\.(js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)(;[^/]*)?$") ? path : null;
        } catch (IllegalArgumentException invalid) { return null; }
    }
    public static String safeSelector(String value) {
        if (value == null || value.length() > 512
            || value.matches("(?i).*(token|secret|password|session|customer|email|private|[0-9]{7,}).*")) return null;
        String part = "[a-zA-Z][a-zA-Z0-9-]*(?:[.#][a-zA-Z_][a-zA-Z0-9_-]{0,63})*(?::nth-(?:child|of-type)\\([1-9][0-9]{0,4}\\))?";
        return value.matches(part + "(?:\\s*>\\s*" + part + ")*") ? value : null;
    }

    private static Map<String, Double> metrics(JsonNode raw) {
        Map<String, Double> values = new TreeMap<>();
        for (String key : METRICS) {
            JsonNode value = raw.path(key);
            if (value.isNumber() && Double.isFinite(value.asDouble()) && value.asDouble() >= 0 && value.asDouble() <= 1e12)
                values.put(key, value.asDouble());
        }
        return values.isEmpty() ? null : Map.copyOf(values);
    }

    private static List<String> attributes(JsonNode raw) {
        if (!raw.isArray()) return null;
        var names = new LinkedHashSet<String>();
        int visited=0;
        for (var value : raw) {
            if (visited++ >= 10) break;
            String name=value.asText();
            if (name.matches("aria-[a-z-]{1,32}") && !name.matches(".*(secret|token|password|private|customer|email).*")) names.add(name);
        }
        return names.isEmpty() ? null : List.copyOf(names);
    }

    public static ObservedEvidence from(Object value) {
        if (value == null) return null; // Historical reports have no new collection metadata.
        JsonNode n = value instanceof JsonNode j ? j : MAPPER.valueToTree(value);
        if (!"observed-evidence-v1".equals(n.path("version").asText())
                || !Set.of("lighthouse", "runtime", "zap", "html").contains(n.path("source").asText())
                || !n.path("items").isArray()) return null;
        List<Item> items = new ArrayList<>();
        boolean truncated = n.path("truncated").asBoolean() || n.path("items").size() > 10;
        int visited = 0;
        for (JsonNode raw : n.path("items")) {
            if (visited++ >= 10) break;
            String kind = raw.path("kind").asText(), origin = null, ref = null, path = null;
            if ("resource".equals(kind)) {
                try {
                    String rawOrigin = raw.path("origin").asText();
                    if (rawOrigin.length() > 512) continue;
                    URI uri = URI.create(rawOrigin);
                    if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null)
                        continue;
                    origin =
                            new URI(
                                            uri.getScheme(),
                                            null,
                                            uri.getHost(),
                                            uri.getPort(),
                                            null,
                                            null,
                                            null)
                                    .toASCIIString();
                } catch (Exception invalid) {
                    continue;
                }
                ref = raw.path("resourceRef").asText();
                if (!ref.matches("[a-f0-9]{16}")) continue;
            } else if ("element".equals(kind)) {
                path = raw.path("nodePath").asText();
                if (path.length() > 512
                        || !path.matches(
                                "(?:[0-9]{1,5},[A-Za-z][A-Za-z0-9-]{0,31})(?:,[0-9]{1,5},[A-Za-z][A-Za-z0-9-]{0,31})*"))
                    path = null;
                if (path == null && (!Set.of("lighthouse", "zap", "html").contains(n.path("source").asText()) || safeSelector(raw.path("selector").asText()) == null)) continue;
            } else continue;
            int code = raw.path("status").isIntegralNumber() ? raw.path("status").asInt(-1) : -1;
            String reason = raw.path("reason").asText(),
                    type = raw.path("resourceType").asText(),
                    owner = raw.path("ownership").asText();
            items.add(
                    new Item(
                            kind,
                            origin,
                            ref,
                            path,
                            code >= 100 && code <= 599 ? code : null,
                            reason.matches("net::ERR_[A-Z_]{1,60}") ? reason : null,
                            TYPES.contains(type) ? type : null,
                            Set.of("FIRST_PARTY", "THIRD_PARTY").contains(owner) ? owner : null,
                            Set.of("lighthouse", "runtime").contains(n.path("source").asText()) && "resource".equals(kind) ? safeResourcePath(raw.path("resourcePath").asText()) : null,
                            Set.of("lighthouse", "zap", "html").contains(n.path("source").asText()) && "element".equals(kind) ? safeSelector(raw.path("selector").asText()) : null,
                            Set.of("lighthouse", "runtime").contains(n.path("source").asText()) ? metrics(raw.path("metrics")) : null,
                            Set.of("lighthouse", "runtime").contains(n.path("source").asText()) && "resource".equals(kind) && "document".equals(type)
                                && "ANALYSED_DOCUMENT".equals(raw.path("locationScope").asText()) ? "ANALYSED_DOCUMENT" : null,
                            "lighthouse".equals(n.path("source").asText()) && "element".equals(kind) ? attributes(raw.path("attributes")) : null));
        }
        int inspected = Math.max(0, Math.min(1000000, n.path("inspected").asInt()));
        return new ObservedEvidence(
                "observed-evidence-v1",
                n.path("source").asText(),
                items.isEmpty() ? "UNAVAILABLE" : "AVAILABLE",
                List.copyOf(items),
                inspected,
                truncated,
                true);
    }

    public ObservedEvidence filter(Predicate<Item> predicate) {
        var selected = items.stream().filter(predicate).toList();
        return new ObservedEvidence(
                version,
                source,
                selected.isEmpty() ? "UNAVAILABLE" : "AVAILABLE",
                selected,
                inspected,
                truncated,
                redacted);
    }
}
