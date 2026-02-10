package com.dokor.argos.services.analysis;

import com.dokor.argos.services.analysis.model.AuditContext;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AuditContextTest {

    @Test
    void shouldCreateDefaultContext() {
        AuditContext ctx = new AuditContext("http://example.com", "https://example.com");

        assertEquals("http://example.com", ctx.inputUrl());
        assertEquals("https://example.com", ctx.normalizedUrl());
        assertNotNull(ctx.startedAt());

        assertNull(ctx.finalUrl());
        assertEquals(0, ctx.httpStatusCode());
        assertEquals(0L, ctx.httpDurationMs());
        assertNotNull(ctx.redirectChain());
        assertTrue(ctx.redirectChain().isEmpty());
        assertNotNull(ctx.headers());
        assertTrue(ctx.headers().isEmpty());
        assertNull(ctx.body());
    }

    @Test
    void shouldEnrichHttpResult() {
        AuditContext ctx = new AuditContext("http://example.com", "http://example.com")
            .withHttpResult(
                "https://example.com",
                200,
                123,
                List.of("http://example.com", "https://example.com"),
                Map.of("content-type", "text/html"),
                "<html/>"
            );

        assertEquals("https://example.com", ctx.finalUrl());
        assertEquals(200, ctx.httpStatusCode());
        assertEquals(123, ctx.httpDurationMs());
        assertEquals(2, ctx.redirectChain().size());
        assertEquals("text/html", ctx.headers().get("content-type"));
        assertEquals("<html/>", ctx.body());
    }
}
