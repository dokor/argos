package com.dokor.argos.services.connected.summary;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** Published finding rows, independent of scoring weights. Mirrors reportModel.ts identity semantics. */
public final class CanonicalFindings {
    private CanonicalFindings() {}
    public static String category(JsonNode issue) {
        var domains = Set.of("performance", "security", "seo", "a11y");
        if (domains.contains(issue.path("categoryKey").asText())) return issue.path("categoryKey").asText();
        for (String field : List.of("categoryKeys", "tags")) for (var value : issue.path(field))
            if (domains.contains(value.asText())) return value.asText();
        return "unknown";
    }
    public static List<JsonNode> from(JsonNode report) {
        var rows = new LinkedHashMap<String, JsonNode>();
        var reserved = new HashSet<String>();
        for (var issue : report.path("issues")) {
            String id = issue.path("id").asText("");
            if (!id.isEmpty()) reserved.add(id);
        }
        int index = 0;
        for (var issue : report.path("issues")) {
            String key = issue.path("id").asText("");
            if (key.isEmpty()) {
                key = "legacy-row-" + index;
                while (reserved.contains(key)) key = "_" + key;
                reserved.add(key);
            }
            index++;
            rows.putIfAbsent(key, issue);
        }
        return List.copyOf(rows.values());
    }
}
