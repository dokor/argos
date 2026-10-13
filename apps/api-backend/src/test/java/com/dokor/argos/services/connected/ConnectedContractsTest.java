package com.dokor.argos.services.connected;

import com.dokor.argos.services.account.UsageService;
import com.dokor.argos.services.connected.contract.ConnectedContracts;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ConnectedContractsTest {
    // The injected application mapper may tolerate unknown fields elsewhere.
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    @Test void everyOpenApiSchemaHasAnExactlyMatchingJavaWireRepresentation() throws Exception {
        JsonNode schemas;
        try (var stream = getClass().getResourceAsStream("/contracts/connected-space.openapi.json")) {
            assertNotNull(stream);
            schemas = mapper.readTree(stream).path("components").path("schemas");
        }
        for (var entries = schemas.fields(); entries.hasNext();) {
            var entry = entries.next();
            var type = Class.forName(ConnectedContracts.class.getName() + "$" + entry.getKey());
            JsonNode example = sample(entry.getValue(), schemas, "");
            var decoded = mapper.readValue(example.toString(), type);
            assertEquals(mapper.readTree(example.toString()), mapper.readTree(mapper.writeValueAsString(decoded)), entry.getKey());
            if (type.isEnum()) {
                assertEquals(entry.getValue().get("enum").toString(), mapper.writeValueAsString(type.getEnumConstants()));
            } else {
                var withIdentity = ((ObjectNode) example).deepCopy().put("ownerId", "2");
                assertThrows(JsonMappingException.class, () -> mapper.readValue(withIdentity.toString(), type), entry.getKey());
            }
        }
    }

    @Test void requiredNullableFieldsAreExplicitAndUnknownFieldsNeverBecomeIdentity() throws Exception {
        assertEquals(new Score(null, false, "UNAVAILABLE"), mapper.readValue(
                "{\"value\":null,\"provisional\":false,\"reason\":\"UNAVAILABLE\"}", Score.class));
        assertThrows(JsonMappingException.class, () -> mapper.readValue("{\"provisional\":false,\"reason\":null}", Score.class));
        assertThrows(JsonMappingException.class, () -> mapper.readValue(
                "{\"discoveryId\":\"1\",\"selectedPageIds\":[\"2\"],\"profileId\":\"server-default-v1\",\"ownerId\":\"3\"}", CreateBatch.class));
        assertThrows(JsonMappingException.class, () -> mapper.readValue(
                "{\"value\":101,\"provisional\":false,\"reason\":null}", Score.class));
        assertThrows(IllegalArgumentException.class, () -> new Coverage(Double.NaN, null));
        assertThrows(IllegalArgumentException.class, () -> new Coverage(80.0, "weighted-coverage-v3"));
        assertThrows(IllegalArgumentException.class, () -> new CreateBatch("1", List.of("2", "2"), "server-default-v1"));
        assertThrows(IllegalArgumentException.class, () -> new CreateBatch("9999999999999999999", List.of("2"), "server-default-v1"));
        assertEquals(List.of("/admin", "/private/"),
                new CreateDiscovery("example.com", 50L, 3L, List.of("/admin", "/private/")).excludedPaths());
        assertThrows(IllegalArgumentException.class, () -> new CreateDiscovery("example.com", 50L, 3L, List.of("admin")));
    }

    @Test void failedAndPartialScoresRemainDistinctAndIdsDoNotLoseJavascriptPrecision() throws Exception {
        var failed = new PageResult("9007199254740993", "https://example.com/", "9007199254740995",
                ExecutionStatus.FAILED, Completeness.NONE, new Score(null, false, "TIMEOUT"),
                new Coverage(null, null), null, null, Map.of(), "TIMEOUT", false);
        JsonNode encoded = mapper.readTree(mapper.writeValueAsString(failed));
        assertEquals("9007199254740993", encoded.get("pageId").textValue());
        assertTrue(encoded.get("criticalCount").isNull());
        assertTrue(encoded.get("score").get("value").isNull());
        var partial = new PageResult("1", "https://example.com/", "2", ExecutionStatus.COMPLETED,
                Completeness.PARTIAL, new Score(72L, true, "INSUFFICIENT_COVERAGE"),
                new Coverage(0.6, "weighted-coverage-v3"), 0L, 2L,
                Map.of("runtime", ModuleStatus.COMPLETED, "zap", ModuleStatus.FAILED), null, true);
        assertEquals(72, mapper.readTree(mapper.writeValueAsString(partial)).get("score").get("value").asInt());
    }

    @Test void existingUsageIsAdaptedWithoutAnotherLedgerOrUnlimitedSentinels() throws Exception {
        for (Long limit : Arrays.asList(null, 0L, 100L, 30L)) {
            var snapshot = new UsageService.Snapshot("FREE", "2026-10", "UTC", "2026-10-01T00:00:00Z",
                    "2026-11-01T00:00:00Z", 32, 4, limit, limit == null || limit > 36);
            var value = ConnectedViews.usage(snapshot);
            assertEquals(limit == null ? null : limit == 100 ? 64L : 0L, value.available());
            assertEquals(snapshot.canLaunch(), value.canLaunch());
            if (limit == null) assertTrue(mapper.readTree(mapper.writeValueAsString(value)).get("limit").isNull());
        }
    }

    private JsonNode sample(JsonNode schema, JsonNode all, String field) {
        if (schema.has("$ref")) return sample(all.get(schema.get("$ref").asText().replace("#/components/schemas/", "")), all, field);
        if (schema.path("nullable").asBoolean()) return NullNode.instance;
        if (schema.has("enum")) return schema.get("enum").get(0);
        return switch (schema.path("type").asText()) {
            case "object" -> {
                ObjectNode value = mapper.createObjectNode();
                schema.path("properties").fields().forEachRemaining(p -> value.set(p.getKey(), sample(p.getValue(), all, p.getKey())));
                yield value;
            }
            case "array" -> {
                ArrayNode value = mapper.createArrayNode();
                for (int i = 0; i < schema.path("minItems").asInt(); i++) value.add(sample(schema.get("items"), all, field));
                yield value;
            }
            case "integer" -> LongNode.valueOf(schema.path("minimum").asLong());
            case "number" -> DoubleNode.valueOf(0);
            case "boolean" -> BooleanNode.FALSE;
            case "string" -> TextNode.valueOf(switch (schema.path("format").asText()) {
                case "argos-id" -> "1";
                case "date-time" -> "2026-10-13T08:00:00Z";
                default -> field.equals("period") ? "2026-10" : field.equals("stablePath") ? "/account/domains/1/batches/2"
                        : schema.path("pattern").asText().startsWith("^[A-Z]") ? "UNAVAILABLE"
                        : field.equals("normalizedUrl") ? "https://example.com/" : "x";
            });
            default -> throw new IllegalArgumentException("Unsupported test schema " + schema);
        };
    }
}
