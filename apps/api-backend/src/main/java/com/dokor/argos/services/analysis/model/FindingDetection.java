package com.dokor.argos.services.analysis.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** Frozen, non-sensitive detection facts. Never reconstructed while reading a historical report. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record FindingDetection(String version, String ruleKey, String ruleVersion, String source,
                               String toolVersion, String scope, String result, Map<String, Double> values) {
    public static final String VERSION = "finding-detection-v1";
    public static final String DETAIL_KEY = "detection";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> VALUE_KEYS = Set.of("length", "minimum", "maximum", "images",
        "missingAlt", "missingPercent", "lowSeverityMaxPercent", "score", "scoreThreshold", "maxFindings");

    public FindingDetection {
        values = values == null ? Map.of() : Map.copyOf(values);
    }

    public static FindingDetection create(String key, String revision, String source, String toolVersion,
                                           String scope, String result, Map<String, Double> values) {
        // A tool response is untrusted; no free text, URL, header, HTML or version suffix is retained.
        String safeVersion = toolVersion != null && toolVersion.matches("[0-9]{1,3}(\\.[0-9]{1,3}){1,3}")
            ? toolVersion : null;
        return new FindingDetection(VERSION, key, revision, source, safeVersion, scope, result, values);
    }

    public static FindingDetection from(Object value, String key, String source) {
        if (value == null) return null;
        JsonNode node = MAPPER.valueToTree(value);
        if (!VERSION.equals(node.path("version").asText()) || !key.equals(node.path("ruleKey").asText())
            || !source.equals(node.path("source").asText())
            || !Set.of("html", "http", "lighthouse").contains(source)
            || !node.path("ruleVersion").asText().matches("[a-z][a-z0-9-]{1,79}")
            || !Set.of("RECEIVED_HTML", "FINAL_HTTP_RESPONSE", "LIGHTHOUSE_NAVIGATION").contains(node.path("scope").asText())
            || !node.path("result").asText().matches("[A-Z_]{1,40}") || !node.path("values").isObject()) return null;
        Map<String, Double> values = new LinkedHashMap<>();
        var fields = node.path("values").fields();
        while (fields.hasNext()) {
            var field = fields.next();
            if (!VALUE_KEYS.contains(field.getKey()) || !field.getValue().isNumber()
                || !Double.isFinite(field.getValue().asDouble()) || field.getValue().asDouble() < 0) return null;
            values.put(field.getKey(), field.getValue().asDouble());
        }
        return create(key, node.path("ruleVersion").asText(), source, node.path("toolVersion").asText(null),
            node.path("scope").asText(), node.path("result").asText(), values);
    }
}
