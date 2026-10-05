package com.dokor.argos.util;

import com.fasterxml.jackson.databind.JsonNode;

/** Defensive Jackson reads preserving the existing analyzer coercions. */
public final class JsonNodes {
    private JsonNodes() {}

    /** Nonblank asText(); numbers/booleans retain Jackson's string coercion. */
    public static String nonBlankText(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String value = node.asText();
        return value == null || value.isBlank() ? null : value;
    }

    /** SSL/Observatory also regard the literal text "null" as absent. */
    public static String text(JsonNode node) {
        String value = nonBlankText(node);
        return "null".equals(value) ? null : value;
    }

    public static String text(JsonNode node, String field) {
        return text(node == null ? null : node.get(field));
    }

    /** Lenient asInt(default): textual integers and booleans remain accepted. */
    public static int intValue(JsonNode node, String field, int defaultValue) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? defaultValue : value.asInt(defaultValue);
    }

    public static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null) return value;
        }
        return null;
    }

    /** Numeric fields only, within int range; textual integers are skipped. */
    public static int firstInt(JsonNode node, int defaultValue, String... fields) {
        for (String field : fields) {
            JsonNode value = node == null ? null : node.get(field);
            if (value != null && value.canConvertToInt()) return value.asInt(defaultValue);
        }
        return defaultValue;
    }
}
