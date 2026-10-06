package com.dokor.argos.services.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ExternalHttpClientTest {
    private HttpServer server;
    private final ExternalHttpClient client = new ExternalHttpClient(new ObjectMapper());

    @AfterEach void stop() { if (server != null) server.stop(0); }

    private URI endpoint(String path) {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort() + path);
    }

    private void serve(int status, String body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
    }

    @Test void acceptsAdditionalJsonFields() throws Exception {
        serve(200, "{\"known\":1,\"future\":true}");
        var result = client.getJson(endpoint("/"), Duration.ofSeconds(2), Duration.ofSeconds(1), 1024, Map.of());
        assertEquals(1, result.path("known").asInt());
        assertTrue(result.path("future").asBoolean());
    }

    @Test void rejectsInvalidJsonAndNonSuccessWithoutLeakingBody() throws Exception {
        serve(200, "not-json");
        assertThrows(IllegalStateException.class,
            () -> client.getJson(endpoint("/"), Duration.ofSeconds(2), Duration.ofSeconds(1), 1024, Map.of()));
        server.stop(0);
        serve(503, "{\"secret\":\"synthetic-test-secret\"}");
        var error = assertThrows(ExternalHttpClient.HttpStatusException.class,
            () -> client.getJson(endpoint("/"), Duration.ofSeconds(2), Duration.ofSeconds(1), 1024, Map.of()));
        assertEquals(503, error.statusCode());
        assertFalse(error.getMessage().contains("synthetic-test-secret"));
    }

    @Test void responseLimitAndDeadlineAreEnforced() throws Exception {
        serve(200, "{\"payload\":\"larger than sixteen bytes\"}");
        assertThrows(Exception.class,
            () -> client.getJson(endpoint("/"), Duration.ofSeconds(2), Duration.ofSeconds(1), 16, Map.of()));
        server.stop(0);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try { Thread.sleep(350); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
            try {
                byte[] bytes = "{}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch (java.io.IOException ignored) {
                // The client should have timed out.
            } finally { exchange.close(); }
        });
        server.start();
        assertThrows(HttpTimeoutException.class,
            () -> client.getJson(endpoint("/"), Duration.ofMillis(80), Duration.ofSeconds(1), 1024, Map.of()));
    }

    @Test void postSendsContentTypeAndConfiguredHeader() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            assertEquals("POST", exchange.getRequestMethod());
            assertEquals("application/json", exchange.getRequestHeaders().getFirst("Content-Type"));
            assertEquals("synthetic-key", exchange.getRequestHeaders().getFirst("X-Test-Key"));
            assertEquals("{\"value\":1}", new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        assertTrue(client.postJson(endpoint("/"), "{\"value\":1}", "application/json",
            Duration.ofSeconds(2), Duration.ofSeconds(1), 1024, Map.of("X-Test-Key", "synthetic-key")).isObject());
    }

    @Test void neverFollowsRedirects() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/redirect", exchange -> {
            exchange.getResponseHeaders().add("Location", endpoint("/destination").toString());
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/destination", exchange -> {
            fail("redirect destination must not be contacted");
            exchange.close();
        });
        server.start();
        var error = assertThrows(ExternalHttpClient.HttpStatusException.class,
            () -> client.getJson(endpoint("/redirect"), Duration.ofSeconds(2),
                Duration.ofSeconds(1), 1024, Map.of()));
        assertEquals(302, error.statusCode());
    }
}
