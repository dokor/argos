package com.dokor.argos.services.domain.report;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Map-based tech payload coercions, intentionally distinct from JsonNode reads. */
final class TechReportValues {
    private TechReportValues() {}

    static Map<String, Object> asMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) return null;
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((key, item) -> result.put(String.valueOf(key), item));
        return result;
    }

    static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    static Double asDouble(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    static Boolean asBoolean(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean bool) return bool;
        String text = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        if (text.equals("true")) return true;
        if (text.equals("false")) return false;
        return null;
    }

    static List<String> asStringList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            if (item != null) result.add(String.valueOf(item));
        }
        return result;
    }
}
