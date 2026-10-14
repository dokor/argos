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
            String ownership) {}

    public static ObservedEvidence from(Object value) {
        if (value == null) return null; // Historical reports have no new collection metadata.
        JsonNode n = value instanceof JsonNode j ? j : MAPPER.valueToTree(value);
        if (!"observed-evidence-v1".equals(n.path("version").asText())
                || !Set.of("lighthouse", "runtime").contains(n.path("source").asText())
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
                                "(?:[0-9]{1,5},[A-Z][A-Z0-9-]{0,31})(?:,[0-9]{1,5},[A-Z][A-Z0-9-]{0,31})*"))
                    continue;
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
                            Set.of("FIRST_PARTY", "THIRD_PARTY").contains(owner) ? owner : null));
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
