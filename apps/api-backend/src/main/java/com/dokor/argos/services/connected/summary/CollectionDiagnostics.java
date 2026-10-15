package com.dokor.argos.services.connected.summary;

import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** Only bounded identifiers and reason codes leave the private frozen projection. */
public final class CollectionDiagnostics {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private CollectionDiagnostics() {}
    public static List<CollectionGap> gaps(String raw) {
        if (raw == null || raw.length() > 2_000_000) return List.of();
        try {
            var d = MAPPER.readValue(raw, DiagnosticProjection.class);
            if (d == null || d.version() != 1 || d.rules() == null || d.rules().size() > 256) return List.of();
            var gaps = new LinkedHashSet<CollectionGap>();
            for (var r : d.rules()) {
                if (r == null || r.outcome() == null || !Set.of("UNAVAILABLE", "BLOCKED_BY_ANTIBOT", "UNKNOWN").contains(r.outcome())) continue;
                if (r.key() == null || !r.key().matches("[a-zA-Z0-9_.-]{1,200}")) continue;
                var sources = r.provenance() == null ? List.<String>of() : r.provenance();
                // Provenance can contain several collectors: retain a neutral identifier when ambiguous.
                var module = sources.size() == 1 && sources.getFirst() != null && sources.getFirst().matches("[a-z0-9_-]{1,32}") ? sources.getFirst() : "unknown";
                gaps.add(new CollectionGap(r.key(), module, DiagnosticProjection.code(r.reason(), r.outcome())));
            }
            return List.copyOf(gaps);
        } catch (java.io.IOException | IllegalArgumentException ignored) { return List.of(); }
    }
    public static Map<String, ModuleStatus> modules(String raw) {
        if (raw == null || raw.length() > 100_000) return Map.of();
        try {
            var nodes=MAPPER.readTree(raw);
            if (nodes == null || !nodes.isArray() || nodes.size()>32) return Map.of();
            var result=new TreeMap<String, ModuleStatus>();
            for (var node:nodes) {
                String id=node.path("id").asText();
                if (!id.matches("[a-z0-9_-]{1,32}")) continue;
                try { result.put(id,ModuleStatus.valueOf(node.path("status").asText())); }
                catch (IllegalArgumentException ignored) { }
            }
            return Map.copyOf(result);
        } catch (java.io.IOException ignored) { return Map.of(); }
    }
}
