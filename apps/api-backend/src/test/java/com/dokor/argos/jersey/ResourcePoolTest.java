package com.dokor.argos.jersey;

import com.coreoz.plume.jersey.grizzly.GrizzlyThreadPoolProbe;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.typesafe.config.ConfigFactory;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.SQLTransientConnectionException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class ResourcePoolTest {
    @Path("/pool-fixture")
    public static class Fixture {
        @GET public String get() { return "ok"; }
    }

    @ParameterizedTest @ValueSource(ints = {1, 2})
    void httpQueueRejectsOverflowAndServesRequestsAfterRecovery(int core) throws Exception {
        var settings = new ConfigurationService(ConfigFactory.parseString("""
            http-grizzly.worker-threads-core-pool-size=%d
            http-grizzly.worker-threads-pool-size=2
            http-grizzly.worker-threads-queue-limit=2
            """.formatted(core)));
        var server = GrizzlySetup.start(new ResourceConfig(Fixture.class),
            new GrizzlyThreadPoolProbe(), "0", "127.0.0.1", settings.httpGrizzlyWorkerThreadPoolConfig());
        var release = new CountDownLatch(1);
        var started = new CountDownLatch(2);
        try {
            var listener = server.getListeners().iterator().next();
            var configured = listener.getTransport().getWorkerThreadPoolConfig();
            assertEquals(core, configured.getCorePoolSize());
            assertEquals(2, configured.getMaxPoolSize());
            assertEquals(2, configured.getQueueLimit());
            var uri = URI.create("http://127.0.0.1:" + listener.getPort() + "/api/pool-fixture");
            var client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
            var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(2)).GET().build();
            assertEquals("ok", client.send(request, HttpResponse.BodyHandlers.ofString()).body());
            ExecutorService pool = listener.getTransport().getWorkerThreadPool();
            Runnable block = () -> {
                started.countDown();
                try { release.await(10, TimeUnit.SECONDS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            };
            pool.execute(block);
            pool.execute(block);
            assertTrue(started.await(5, TimeUnit.SECONDS));
            var drained = new CountDownLatch(2);
            pool.execute(drained::countDown);
            pool.execute(drained::countDown);
            assertThrows(RejectedExecutionException.class, () -> pool.execute(() -> {}));
            // The production error page maps pre-Jersey executor rejection to a retryable 503.
            var rejected = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(503, rejected.statusCode());
            assertEquals("1", rejected.headers().firstValue("Retry-After").orElseThrow());
            assertEquals("Service Unavailable", rejected.body());
            release.countDown();
            assertTrue(drained.await(5, TimeUnit.SECONDS));
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode());
            assertEquals("ok", response.body());
        } finally {
            release.countDown();
            server.shutdownNow();
        }
    }

    @Test void shippedHikariProfileBoundsConnectionsAndWaitThenRecovers() throws Exception {
        var config = ConfigFactory.parseFile(new File("src/main/resources/application.conf")).resolve();
        new ConfigurationService(config).validateResourcePools();
        var properties = new Properties();
        for (String key : java.util.List.of("maximumPoolSize", "minimumIdle", "connectionTimeout")) {
            properties.setProperty(key, Integer.toString(config.getInt("db.hikari." + key)));
        }
        properties.setProperty("dataSourceClassName", "org.h2.jdbcx.JdbcDataSource");
        properties.setProperty("dataSource.url", "jdbc:h2:mem:resource-pool-fixture");
        var hikari = new HikariConfig(properties);
        assertEquals(6, hikari.getMaximumPoolSize());
        assertEquals(1, hikari.getMinimumIdle());
        assertEquals(5000, hikari.getConnectionTimeout());
        try (var pool = new HikariDataSource(hikari)) {
            var held = new ArrayList<Connection>();
            try {
                for (int i = 0; i < 6; i++) held.add(pool.getConnection());
                assertEquals(6, pool.getHikariPoolMXBean().getActiveConnections());
                long start = System.nanoTime();
                assertThrows(SQLTransientConnectionException.class, pool::getConnection);
                long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
                assertTrue(elapsed >= 4500 && elapsed < 10000, "DB wait must be bounded: " + elapsed);
                held.remove(0).close();
                try (var recovered = pool.getConnection()) { assertTrue(recovered.isValid(1)); }
            } finally {
                for (var connection : held) connection.close();
            }
        }
    }
}
