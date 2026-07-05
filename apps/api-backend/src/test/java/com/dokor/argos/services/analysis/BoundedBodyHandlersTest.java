package com.dokor.argos.services.analysis;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests de {@link BoundedBodyHandlers} (#220) : la logique de plafonnement
 * ({@code readLimited}) est testée directement, et le handler complet est validé
 * de bout en bout via un serveur HTTP en processus (localhost, port éphémère —
 * aucune dépendance réseau).
 */
class BoundedBodyHandlersTest {

    // -------------------------
    // readLimited (logique de plafonnement)
    // -------------------------

    @Test
    void readLimited_readsWhenUnderLimit() {
        byte[] data = "hello world".getBytes(StandardCharsets.UTF_8);
        String result = BoundedBodyHandlers.readLimited(new ByteArrayInputStream(data), 1_000);
        assertEquals("hello world", result);
    }

    @Test
    void readLimited_throwsWhenExceedingLimit() {
        byte[] data = new byte[10_000];
        Arrays.fill(data, (byte) 'x');
        assertThrows(UncheckedIOException.class,
            () -> BoundedBodyHandlers.readLimited(new ByteArrayInputStream(data), 1_000));
    }

    @Test
    void readLimited_acceptsBodyExactlyAtLimit() {
        byte[] data = new byte[1_000];
        Arrays.fill(data, (byte) 'a');
        String result = BoundedBodyHandlers.readLimited(new ByteArrayInputStream(data), 1_000);
        assertEquals(1_000, result.length());
    }

    // -------------------------
    // Handler complet (bout en bout)
    // -------------------------

    @Test
    void ofString_rejectsOversizedResponseAndReadsWhenUnderLimit() throws Exception {
        byte[] payload = new byte[10_000];
        Arrays.fill(payload, (byte) 'x');

        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            exchange.sendResponseHeaders(200, payload.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(payload);
            }
        });
        server.start();

        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest req = HttpRequest.newBuilder(
                URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/")).build();

            // Corps de 10 000 octets > limite de 1 000 → la lecture échoue.
            assertThrows(Exception.class,
                () -> client.send(req, BoundedBodyHandlers.ofString(1_000)));

            // Sous la limite → lecture normale, corps intégral.
            HttpResponse<String> ok = client.send(req, BoundedBodyHandlers.ofString(20_000));
            assertEquals(200, ok.statusCode());
            assertEquals(10_000, ok.body().length());
        } finally {
            server.stop(0);
        }
    }
}
