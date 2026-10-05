package com.dokor.argos.services.analysis.modules.zap;

import com.dokor.argos.services.analysis.model.AuditContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ZapClientTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private HttpServer server;
    private final List<String> calls = new ArrayList<>();
    private JsonNode imported;
    private int pending;
    private boolean failImport;
    private boolean emptyImport;
    private boolean neverFinish;
    private String key;

    @AfterEach void stop() { if (server != null) server.stop(0); }

    private ZapClient client(Duration budget) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/JSON/", exchange -> {
            String operation = exchange.getRequestURI().getPath().substring(6);
            calls.add(operation);
            key = exchange.getRequestHeaders().getFirst("X-ZAP-API-Key");
            Map<String, String> params = new HashMap<>();
            for (String pair : new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8).split("&")) {
                if (pair.isEmpty()) continue;
                String[] parts = pair.split("=", 2);
                params.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8), URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
            }
            String response;
            switch (operation) {
                case "core/action/newSession/" -> { imported = null; response = "{\"Result\":\"OK\"}"; }
                case "exim/action/importHar/" -> {
                    assertEquals("false", params.get("sendRequests"));
                    assertEquals("1", params.get("maxMessages"));
                    imported = MAPPER.readTree(params.get("data"));
                    pending = 2;
                    response = failImport ? "{\"code\":\"no_implementor\"}" : "{\"Result\":\"OK\"}";
                }
                case "pscan/view/recordsToScan/" -> {
                    int count = neverFinish && imported != null ? 1 : Math.max(0, pending--);
                    response = "{\"recordsToScan\":\"" + count + "\"}";
                }
                case "core/view/numberOfMessages/" -> {
                    // The real daemon includes API/internal messages when baseurl is omitted.
                    int count = emptyImport ? 0 : params.containsKey("baseurl") ? 1 : 2;
                    response = "{\"numberOfMessages\":\"" + count + "\"}";
                }
                case "core/view/alerts/" -> { assertTrue(pending <= 0); response = "{\"alerts\":[]}"; }
                default -> response = "{\"code\":\"unexpected_operation\"}";
            }
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return new ZapClient(MAPPER, "http://127.0.0.1:" + server.getAddress().getPort(), "synthetic-key",
            budget, Duration.ofMillis(10));
    }

    private static AuditContext snapshot(String url) {
        return new AuditContext(url, url, 1).withHttpResult(url, 200, 12, List.of(),
            Map.of("content-type", "text/html", "content-encoding", "gzip", "content-length", "3"), "<html>é</html>");
    }

    @Test void importsCollectedBytesAndWaitsBeforeReadingAlerts() throws Exception {
        assertTrue(client(Duration.ofSeconds(3)).analyze(snapshot("https://example.com/a?x=1&y=2")).path("alerts").isArray());
        var entry = imported.path("log").path("entries").get(0);
        assertEquals("https://example.com/a?x=1&y=2", entry.path("request").path("url").asText());
        assertEquals("<html>é</html>", entry.path("response").path("content").path("text").asText());
        assertFalse(entry.path("response").path("headers").toString().contains("gzip"));
        assertEquals("synthetic-key", key);
        assertEquals("core/view/alerts/", calls.getLast());
        assertTrue(calls.indexOf("exim/action/importHar/") > calls.indexOf("core/action/newSession/"));
        assertTrue(calls.stream().noneMatch(p -> p.contains("spider") || p.contains("ascan") || p.contains("sendRequest")));
    }

    @Test void startsANewSessionForEachAudit() throws Exception {
        var client = client(Duration.ofSeconds(3));
        client.analyze(snapshot("https://example.com/first"));
        client.analyze(snapshot("https://example.com/second"));
        assertEquals(2, calls.stream().filter("core/action/newSession/"::equals).count());
        assertEquals("https://example.com/second", imported.path("log").path("entries").get(0).path("request").path("url").asText());
    }

    @Test void unavailableAddonDoesNotBecomeANoAlertsSuccess() throws Exception {
        failImport = true;
        assertThrows(IllegalStateException.class, () -> client(Duration.ofSeconds(2)).analyze(snapshot("https://example.com")));
        assertFalse(calls.contains("core/view/alerts/"));
    }

    @Test void emptyImportDoesNotBecomeANoAlertsSuccess() throws Exception {
        emptyImport = true;
        assertThrows(IllegalStateException.class, () -> client(Duration.ofSeconds(2)).analyze(snapshot("https://example.com")));
        assertFalse(calls.contains("core/view/alerts/"));
    }

    @Test void unfinishedPassiveScanRemainsBounded() throws Exception {
        neverFinish = true;
        var client = client(Duration.ofMillis(300));
        assertTimeoutPreemptively(Duration.ofSeconds(2),
            () -> assertThrows(Exception.class, () -> client.analyze(snapshot("https://example.com"))));
        assertFalse(calls.contains("core/view/alerts/"));
    }

    @Test void missingSnapshotNeverContactsTheDaemon() throws Exception {
        var client = client(Duration.ofSeconds(2));
        assertThrows(IllegalStateException.class, () -> client.analyze(new AuditContext("https://example.com", "https://example.com", 1)));
        assertTrue(calls.isEmpty());
    }
}
