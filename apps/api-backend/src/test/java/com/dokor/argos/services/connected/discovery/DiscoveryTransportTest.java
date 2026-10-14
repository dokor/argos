package com.dokor.argos.services.connected.discovery;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import com.typesafe.config.ConfigFactory;

import org.junit.jupiter.api.*;

import java.io.*;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.GZIPOutputStream;

class DiscoveryTransportTest {
    HttpServer proxy;
    DiscoveryTransport transport;
    AtomicInteger requests = new AtomicInteger();
    ExecutorService executor;

    @BeforeEach
    void setup() throws Exception {
        proxy = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newCachedThreadPool(Thread.ofPlatform().daemon().factory());
        proxy.setExecutor(executor);
        proxy.createContext(
                "/",
                exchange -> {
                    requests.incrementAndGet();
                    assertNull(exchange.getRequestHeaders().getFirst("Cookie"));
                    assertNull(exchange.getRequestHeaders().getFirst("Authorization"));
                    String path = exchange.getRequestURI().getPath();
                    byte[] body = "<p>bounded</p>".getBytes();
                    try {
                        if (path.equals("/large")) body = new byte[4096];
                        if (path.equals("/gzip")) {
                            var out = new ByteArrayOutputStream();
                            try (var zip = new GZIPOutputStream(out)) {
                                zip.write(new byte[4096]);
                            }
                            body = out.toByteArray();
                            exchange.getResponseHeaders().add("Content-Encoding", "gzip");
                        }
                        if (path.equals("/redirect"))
                            exchange.getResponseHeaders()
                                    .add("Location", "http://127.0.0.1/private");
                        exchange.getResponseHeaders().add("Content-Type", "text/html");
                        exchange.sendResponseHeaders(
                                path.equals("/redirect") ? 302 : 200,
                                path.equals("/slow") ? 0 : body.length);
                        if (path.equals("/slow")) {
                            exchange.getResponseBody().write('x');
                            exchange.getResponseBody().flush();
                            Thread.sleep(1500);
                        }
                        exchange.getResponseBody().write(body);
                    } catch (Exception ignored) {
                    } finally {
                        exchange.close();
                    }
                });
        proxy.start();
        var policy = new DiscoveryPolicy(ConfigFactory.empty());
        transport =
                new DiscoveryTransport(
                        policy,
                        HttpClient.newBuilder()
                                .proxy(ProxySelector.of(proxy.getAddress()))
                                .followRedirects(HttpClient.Redirect.NEVER)
                                .build());
    }

    @AfterEach
    void cleanup() {
        proxy.stop(0);
        executor.shutdownNow();
    }

    DiscoveryBudget budget() {
        return new DiscoveryBudget(Duration.ofSeconds(3), () -> false);
    }

    @Test
    void realHttpProxyBodyIsBoundedAndHeadersAreClean() {
        assertEquals(200, transport.get("http://8.8.8.8/", 1024, budget()).status());
        assertEquals(
                "BODY_LIMIT",
                assertThrows(
                                DiscoveryStop.class,
                                () -> transport.get("http://8.8.8.8/large", 1024, budget()))
                        .code);
    }

    @Test
    void compressedBombIsBoundedAfterDecompression() {
        assertEquals(
                "BODY_LIMIT",
                assertThrows(
                                DiscoveryStop.class,
                                () -> transport.get("http://8.8.8.8/gzip", 1024, budget()))
                        .code);
    }

    @Test
    void redirectsAreNeverAutomaticallyFollowed() {
        assertEquals(302, transport.get("http://8.8.8.8/redirect", 1024, budget()).status());
        assertEquals(1, requests.get());
    }

    @Test
    void privateIpv4Ipv6AndCredentialsNeverReachTransport() {
        for (String url :
                new String[] {
                    "http://127.0.0.1/",
                    "http://10.0.0.1/",
                    "http://169.254.169.254/",
                    "http://[::1]/",
                    "http://user@8.8.8.8/",
                    "http://8.8.8.8:81/"
                }) assertThrows(DiscoveryStop.class, () -> transport.get(url, 1024, budget()));
        assertEquals(0, requests.get());
    }

    @Test
    void slowBodyIsCanceledByWholeOperationDeadline() {
        long start = System.nanoTime();
        assertThrows(
                DiscoveryStop.class,
                () ->
                        transport.get(
                                "http://8.8.8.8/slow",
                                1024,
                                new DiscoveryBudget(Duration.ofMillis(100), () -> false)));
        assertTrue(Duration.ofNanos(System.nanoTime() - start).toMillis() < 1000);
    }

    @Test
    void cancellationWhileWaitingForBodyReturnsPromptly() {
        long start = System.nanoTime();
        assertEquals(
                "CANCELED",
                assertThrows(
                                DiscoveryStop.class,
                                () ->
                                        transport.get(
                                                "http://8.8.8.8/slow",
                                                1024,
                                                new DiscoveryBudget(
                                                        Duration.ofSeconds(3),
                                                        () ->
                                                                System.nanoTime() - start
                                                                        > 100_000_000)))
                        .code);
        assertTrue(Duration.ofNanos(System.nanoTime() - start).toMillis() < 1000);
    }
}
