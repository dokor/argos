package com.dokor.argos.services.analysis.modules.runtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PlaywrightRuntimeClientTest {
    private final ObjectMapper sharedMapper = new ObjectMapper();
    private final PlaywrightRuntimeClient client = new PlaywrightRuntimeClient(sharedMapper);

    private static final String RESPONSE = """
        {
          "url":"https://example.com",
          "finalUrl":"https://example.com/",
          "timings":{"domContentLoadedMs":100,"loadMs":200},
          "console":{"errors":0,"warnings":0,"samples":[]},
          "jsErrors":{"count":0,"samples":[]},
          "network":{"requests":1,"failedRequests":0,"status4xx":0,"status5xx":0,
                     "totalBytesEstimated":42,"byType":{},"topLargest":[]}
        }
        """;

    @Test
    void ignoresAdditionalExternalFieldsWithoutChangingSharedMapper() throws Exception {
        String extended = RESPONSE.replace("\"loadMs\":200", "\"loadMs\":200,\"newTiming\":3")
            .replace("\"samples\":[]", "\"samples\":[],\"newField\":true")
            .replace("\"topLargest\":[]", "\"topLargest\":[],\"newNetwork\":true")
            .replace("\"finalUrl\":\"https://example.com/\"", "\"finalUrl\":\"https://example.com/\",\"newTopLevel\":true");

        var parsed = client.parseResponse(sharedMapper.readTree(extended));
        assertEquals(42L, parsed.network().totalBytesEstimated());
        assertEquals(0, parsed.console().errors());
        assertThrows(Exception.class, () -> sharedMapper.readValue(extended,
            PlaywrightRuntimeClient.RuntimeAnalyzeResponse.class));
    }

    @Test
    void acceptsMissingCounterWithoutFabricatingZero() throws Exception {
        String incomplete = RESPONSE.replace("\"failedRequests\":0,", "");
        var parsed = client.parseResponse(sharedMapper.readTree(incomplete));
        assertNull(parsed.network().failedRequests());
        assertEquals(0, parsed.network().status5xx());
    }

    @Test
    void acceptsPartialSectionsAndNavigationFailure() throws Exception {
        var parsed = client.parseResponse(sharedMapper.readTree("""
            {"url":"https://example.com","finalUrl":"https://example.com/",
             "timings":{"domContentLoadedMs":null,"loadMs":null},
             "navigation":{"status":"FAILED","reason":"NAVIGATION_ERROR"},
             "console":{"errors":2,"samples":[{"type":"error","text":"failure"}]}}
            """));
        assertNull(parsed.network());
        assertNull(parsed.timings().loadMs());
        assertEquals("FAILED", parsed.navigation().status());
        assertEquals(2, parsed.console().errors());
    }

    @Test
    void emptyObservationsAreUnavailable() throws Exception {
        assertThrows(IllegalStateException.class, () -> client.parseResponse(sharedMapper.readTree("""
            {"url":"https://example.com","finalUrl":"https://example.com/","console":{},"network":{}}
            """)));
    }

    @Test
    void rejectsNegativeUsefulCounter() throws Exception {
        String invalid = RESPONSE.replace("\"status5xx\":0", "\"status5xx\":-1");
        assertThrows(IllegalStateException.class, () -> client.parseResponse(sharedMapper.readTree(invalid)));
    }
}
