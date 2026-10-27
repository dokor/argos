package com.dokor.argos.services.analysis.modules.ssl;

import com.dokor.argos.services.analysis.AuditDeadline;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class SslLabsClientTest {
    private HttpServer server;
    private final List<String> queries = new ArrayList<>();

    @AfterEach void stop() { if (server != null) server.stop(0); }

    private SslLabsClient client(Duration budget, int readyAfter, int httpStatus, String terminal) throws Exception {
        AtomicInteger calls = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/analyze", exchange -> {
            queries.add(exchange.getRequestURI().getRawQuery());
            String status = calls.incrementAndGet() >= readyAfter ? terminal : "IN_PROGRESS";
            byte[] bytes = ("{\"status\":\"" + status + "\"}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(httpStatus, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        return new SslLabsClient(new ObjectMapper(), "http://127.0.0.1:" + server.getAddress().getPort(),
            budget, Duration.ofMillis(10), Duration.ofMillis(10));
    }

    @Test void acceptsAnAssessmentThatNeedsMoreThanFivePolls() throws Exception {
        var client = client(Duration.ofSeconds(3), 8, 200, "READY");
        assertEquals("READY", client.analyze("example.com").path("status").asText());
        assertEquals(8, queries.size());
        assertTrue(queries.stream().allMatch(q -> !q.contains("fromCache") && q.contains("all=done") && q.contains("publish=off")));
        assertTrue(queries.getFirst().contains("startNew=on"));
        assertTrue(queries.stream().skip(1).noneMatch(q -> q.contains("startNew")));
    }

    @Test void readyAssessmentNeedsOnlyOneCall() throws Exception {
        assertEquals("READY", client(Duration.ofSeconds(2), 1, 200, "READY").analyze("example.com").path("status").asText());
        assertEquals(1, queries.size());
        assertTrue(queries.getFirst().contains("startNew=on"));
    }

    @Test void consecutiveAuditsEachRequestANewAssessment() throws Exception {
        var client = client(Duration.ofSeconds(2), 1, 200, "READY");
        client.analyze("example.com");
        client.analyze("example.com");
        assertEquals(2, queries.size());
        assertTrue(queries.stream().allMatch(q -> q.contains("startNew=on") && !q.contains("fromCache")));
    }

    @Test void pendingResultHasItsOwnDiagnosticAndRemainsBounded() throws Exception {
        var client = client(Duration.ofMillis(250), Integer.MAX_VALUE, 200, "READY");
        var error = assertTimeoutPreemptively(Duration.ofSeconds(2),
            () -> assertThrows(HttpTimeoutException.class, () -> client.analyze("example.com")));
        assertTrue(error.getMessage().contains("lastStatus=IN_PROGRESS"));
        assertFalse(error.getMessage().contains("rate limit"));
    }

    @Test void honorsTheShorterSharedAuditBudget() throws Exception {
        var client = client(Duration.ofSeconds(10), Integer.MAX_VALUE, 200, "READY");
        try (var scope = new AuditDeadline(Duration.ofMillis(200)).enter()) {
            long started = System.nanoTime();
            assertThrows(HttpTimeoutException.class, () -> client.analyze("example.com"));
            assertTrue(System.nanoTime() - started < Duration.ofSeconds(2).toNanos());
        }
    }

    @Test void quotaErrorIsNotReportedAsPending() throws Exception {
        var error = assertThrows(IllegalStateException.class,
            () -> client(Duration.ofSeconds(2), 1, 429, "ERROR").analyze("example.com"));
        assertTrue(error.getMessage().contains("HTTP 429"));
        assertEquals(1, queries.size());
    }

    @Test void upstreamAssessmentErrorNeverReturnsIncompleteData() throws Exception {
        var error = assertThrows(IllegalStateException.class,
            () -> client(Duration.ofSeconds(2), 1, 200, "ERROR").analyze("example.com"));
        assertEquals(com.dokor.argos.services.analysis.CollectorFailure.Code.TARGET_ASSESSMENT_FAILED,
            com.dokor.argos.services.analysis.CollectorFailure.classify(error));
    }
    @Test void disabledClientNeverContactsTheProvider() throws Exception {
        var config = org.mockito.Mockito.mock(com.dokor.argos.services.configuration.ConfigurationService.class);
        org.mockito.Mockito.when(config.sslLabsApiUrl()).thenReturn("https://api.ssllabs.com/api/v3");
        org.mockito.Mockito.when(config.sslLabsTimeout()).thenReturn(Duration.ofSeconds(90));
        var http = org.mockito.Mockito.mock(com.dokor.argos.services.analysis.ExternalHttpClient.class);
        var client = new SslLabsClient(http, config);
        assertThrows(com.dokor.argos.services.analysis.CollectorFailure.class, () -> client.analyze("example.com"));
        org.mockito.Mockito.verifyNoInteractions(http);
    }

    @Test void malformedHostNeverContactsTheProvider() throws Exception {
        var client = client(Duration.ofSeconds(2), 1, 200, "READY");
        assertThrows(IllegalArgumentException.class, () -> client.analyze("example.com:443"));
        assertTrue(queries.isEmpty());
    }}
