package com.dokor.argos.services.ci;

import com.dokor.argos.services.ci.errors.*;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CiErrorsTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private JsonNode resource(String name) throws Exception {
        try (var stream = getClass().getResourceAsStream("/ci/" + name)) {
            assertNotNull(stream); return mapper.readTree(stream);
        }
    }
    private Set<String> values(JsonNode array) {
        var result = new HashSet<String>(); array.forEach(item -> result.add(item.asText())); return result;
    }
    private <T extends Enum<T>> Set<String> names(T[] enums) {
        return Arrays.stream(enums).map(Enum::name).collect(Collectors.toSet());
    }

    @Test void javaCatalogAndSchemaStayInSyncForEveryErrorFamily() throws Exception {
        var schema = resource("error-response-v1.schema.json");
        var catalog = resource("error-catalog-v1.json");
        assertEquals(1, catalog.path("schemaVersion").asInt());
        var errors = catalog.path("errors");
        var fields = schema.path("properties").path("error").path("properties");
        var codes = names(CiErrorCode.values());
        var catalogCodes = new HashSet<String>(); errors.fieldNames().forEachRemaining(catalogCodes::add);
        assertEquals(codes, catalogCodes);
        assertEquals(codes, values(fields.path("code").path("enum")));
        assertEquals(names(CiErrorCode.Stage.values()), values(fields.path("stage").path("enum")));
        assertEquals(names(CiErrorCode.Category.values()), values(fields.path("category").path("enum")));
        assertEquals(names(CiErrorCode.Action.values()), values(fields.path("actionCode").path("enum")));
        assertEquals(names(CiErrorCode.Recovery.values()), values(fields.path("recovery").path("enum")));
        assertEquals(CiErrors.MAX_RETRY_AFTER_SECONDS, fields.path("retryAfterSeconds").path("maximum").asLong());
        for (var code : CiErrorCode.values()) {
            var entry = errors.path(code.name());
            assertEquals(code.httpStatus(), entry.path("httpStatus").asInt(), code.name());
            var error = mapper.valueToTree(CiErrors.create(code, null)).path("error");
            for (String field : List.of("stage", "category", "messageKey", "actionCode", "retryable", "recovery"))
                assertEquals(entry.path(field), error.path(field), code.name() + "." + field);
            for (String locale : List.of("fr", "en")) for (String field : List.of("message", "action")) {
                String text = entry.path(locale).path(field).asText();
                assertTrue(text.length() > 10 && text.length() < 300, code.name());
                assertFalse(text.matches("(?s).*[\\r\\n\\u001b<>@].*"), code.name());
                assertFalse(text.contains("::"), code.name());
            }
            assertTrue(code.documentationPath(false).matches("/docs/errors#[a-z-]+"));
            assertTrue(code.documentationPath(true).matches("/en/docs/errors#[a-z-]+"));
        }
    }

    @Test void envelopeHasOnlyWhitelistedFieldsAndAnOpaqueFreshIdentifier() throws Exception {
        var allowed = Set.of("schemaVersion", "requestId", "error");
        var errorFields = Set.of("code", "stage", "category", "messageKey", "actionCode", "retryable", "recovery", "retryAfterSeconds");
        var ids = new HashSet<String>();
        for (var code : CiErrorCode.values()) {
            var envelope = CiErrors.create(code, null);
            assertTrue(ids.add(envelope.requestId()));
            assertEquals(4, UUID.fromString(envelope.requestId()).version());
            var json = mapper.valueToTree(envelope);
            var keys = new HashSet<String>(); json.fieldNames().forEachRemaining(keys::add);
            assertEquals(allowed, keys);
            keys.clear(); json.path("error").fieldNames().forEachRemaining(keys::add);
            assertEquals(errorFields, keys);
            assertTrue(mapper.writeValueAsBytes(envelope).length < 4096);
        }
    }

    @Test void headersAndRetryInstructionsAreSafeAndBounded() {
        for (var code : CiErrorCode.values()) {
            try (var response = CiErrors.response(code, null)) {
                assertEquals(code.httpStatus(), response.getStatus());
                assertEquals("private, no-store", response.getHeaderString("Cache-Control"));
                assertEquals("nosniff", response.getHeaderString("X-Content-Type-Options"));
                assertNull(response.getHeaderString("Retry-After"));
            }
            if (code.acceptsRetryAfter()) {
                try (var response = CiErrors.response(code, 30L)) {
                    assertEquals("30", response.getHeaderString("Retry-After"));
                }
                for (long invalid : new long[]{-1, 0, CiErrors.MAX_RETRY_AFTER_SECONDS + 1, Long.MAX_VALUE})
                    assertThrows(IllegalArgumentException.class, () -> CiErrors.create(code, invalid));
            } else assertThrows(IllegalArgumentException.class, () -> CiErrors.create(code, 1L));
        }
        assertFalse(CiErrorCode.QUOTA_EXCEEDED.retryable());
        assertFalse(CiErrorCode.IDEMPOTENCY_CONFLICT.retryable());
        assertEquals(CiErrorCode.Recovery.RECONCILE_PUBLICATION, CiErrorCode.PUBLICATION_STATE_UNKNOWN.recovery());
    }

    @Test void inaccessibleAccountHasTheSamePublicAuthenticationFailure() {
        assertEquals(CiErrorCode.AUTHENTICATION_FAILED,
            CiErrors.entitlementCode(CiEntitlementService.Denial.ACCOUNT_INACCESSIBLE));
        assertEquals(CiErrorCode.FEATURE_NOT_AVAILABLE,
            CiErrors.entitlementCode(CiEntitlementService.Denial.FEATURE_NOT_AVAILABLE));
    }

    @Test void globalNullOmissionCannotBreakTheVersionedEnvelope() {
        var omittingMapper = new ObjectMapper().setSerializationInclusion(
            com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
        var json = omittingMapper.valueToTree(CiErrors.create(CiErrorCode.AUTHENTICATION_FAILED, null));
        assertTrue(json.path("error").has("retryAfterSeconds"));
        assertTrue(json.path("error").path("retryAfterSeconds").isNull());
    }
}
