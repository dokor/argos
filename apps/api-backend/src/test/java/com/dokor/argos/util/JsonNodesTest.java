package com.dokor.argos.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class JsonNodesTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @ParameterizedTest
    @CsvSource(value = {"null|", "{}|", "[]|", "\"\"|", "\"  \"|", "\"null\"|",
        "42|42", "true|true", "false|false", "\"A\"|A", "\" A \"|' A '"}, delimiter = '|')
    void textCoercionsRemainCompatible(String json, String expected) throws Exception {
        assertEquals(expected, JsonNodes.text(MAPPER.readTree(json)));
    }

    @Test
    void absenceAndLiteralNullHaveExplicitContracts() throws Exception {
        assertNull(JsonNodes.text(null));
        assertNull(JsonNodes.text(MissingNode.getInstance()));
        assertNull(JsonNodes.nonBlankText(null));
        assertNull(JsonNodes.nonBlankText(MissingNode.getInstance()));
        assertEquals("null", JsonNodes.nonBlankText(MAPPER.readTree("\"null\"")));
        assertNull(JsonNodes.text(MAPPER.readTree("{}"), "missing"));
        assertNull(JsonNodes.text(MAPPER.readTree("true"), "missing"));
    }

    @ParameterizedTest
    @CsvSource(value = {"null|-1", "{}|-1", "[]|-1", "\"bogus\"|-1", "\"42\"|42",
        "42|42", "2.9|2", "true|1", "false|0"}, delimiter = '|')
    void singleIntReadRetainsLenientJacksonCoercion(String json, int expected) throws Exception {
        assertEquals(expected, JsonNodes.intValue(MAPPER.readTree("{\"value\":" + json + "}"), "value", -1));
    }

    @Test
    void firstOfSkipsAbsentAndUnusableValuesButKeepsNumericOnlyIntRule() throws Exception {
        var node = MAPPER.readTree("""
            {"nullText":"null", "blank":" ", "object":{}, "label":"good",
             "textInt":"12", "tooBig":2147483648, "bool":true, "decimal":3.9, "last":8}
            """);
        assertEquals("good", JsonNodes.firstText(node, "absent", "nullText", "blank", "object", "label"));
        assertEquals(3, JsonNodes.firstInt(node, -1, "absent", "textInt", "tooBig", "bool", "decimal", "last"));
        assertEquals(-1, JsonNodes.firstInt(node, -1, "textInt", "tooBig", "bool"));
        assertNull(JsonNodes.firstText(null, "value"));
        assertEquals(-1, JsonNodes.firstInt(null, -1, "value"));
        assertEquals(-1, JsonNodes.intValue(null, "value", -1));
        assertEquals(-1, JsonNodes.intValue(MissingNode.getInstance(), "value", -1));
        assertEquals(-1, JsonNodes.intValue(node, "absent", -1));
        assertNull(JsonNodes.firstText(node));
        assertEquals(-1, JsonNodes.firstInt(node, -1));
    }
}
