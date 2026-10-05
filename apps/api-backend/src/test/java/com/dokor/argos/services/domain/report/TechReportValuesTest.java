package com.dokor.argos.services.domain.report;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.dokor.argos.services.domain.report.TechReportValues.*;
import static org.junit.jupiter.api.Assertions.*;

class TechReportValuesTest {
    @Test
    void mapReadCopiesAndStringifiesKeysWithoutChangingValues() {
        Map<Object, Object> source = new LinkedHashMap<>();
        source.put(3, "three");
        source.put(null, null);
        var result = asMap(source);
        assertEquals(Arrays.asList("3", "null"), List.copyOf(result.keySet()));
        assertEquals("three", result.get("3"));
        assertTrue(result.containsKey("null"));
        result.put("added", true);
        assertEquals(2, source.size());
        assertNull(asMap(null));
        assertNull(asMap(List.of()));
    }

    @Test
    void techStringsRetainEmptyAndLiteralNullValues() {
        assertNull(asString(null));
        assertEquals("", asString(""));
        assertEquals("null", asString("null"));
        assertEquals("7", asString(7));
        assertEquals("false", asString(false));
    }

    @Test
    void confidenceNumbersKeepLegacyParsing() {
        assertNull(asDouble(null));
        assertNull(asDouble(true));
        assertNull(asDouble(Map.of()));
        assertNull(asDouble("bad"));
        assertEquals(0.95, asDouble(" 0.95 "));
        assertEquals(2.0, asDouble(2));
        assertTrue(asDouble("NaN").isNaN());
    }

    @Test
    void booleansAcceptOnlyTrueFalseIgnoringCaseAndWhitespace() {
        assertNull(asBoolean(null));
        assertNull(asBoolean(1));
        assertNull(asBoolean("yes"));
        assertNull(asBoolean(Map.of()));
        assertEquals(true, asBoolean(true));
        assertEquals(false, asBoolean(false));
        assertEquals(true, asBoolean(" TRUE "));
        assertEquals(false, asBoolean(" False "));
    }

    @Test
    void evidenceSkipsNullsButKeepsAllOtherListItems() {
        assertEquals(List.of("", "null", "3", "false"), asStringList(Arrays.asList(null, "", "null", 3, false)));
        assertEquals(List.of(), asStringList(null));
        assertEquals(List.of(), asStringList("single"));
    }
}
