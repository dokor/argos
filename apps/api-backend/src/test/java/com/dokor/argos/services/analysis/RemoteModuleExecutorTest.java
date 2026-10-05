package com.dokor.argos.services.analysis;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class RemoteModuleExecutorTest {
    @Test void twoRemoteCallsOverlapAndCarryTheRunContext() throws Exception {
        var bothStarted = new CountDownLatch(2);
        MDC.put("runId", "synthetic-run");
        try (var executor = new RemoteModuleExecutor(Duration.ofSeconds(5));
             var ssl = executor.submit("ssl", () -> { bothStarted.countDown(); assertTrue(bothStarted.await(2, TimeUnit.SECONDS));
                 assertEquals("synthetic-run", MDC.get("runId")); return MDC.get("module"); });
             var observatory = executor.submit("observatory", () -> { bothStarted.countDown(); assertTrue(bothStarted.await(2, TimeUnit.SECONDS));
                 assertEquals("synthetic-run", MDC.get("runId")); return MDC.get("module"); })) {
            assertEquals("ssl", ssl.await());
            assertEquals("observatory", observatory.await());
        } finally { MDC.clear(); }
    }
    @Test void poolAndQueueAreBoundedAndSaturationIsReported() throws Exception {
        var started = new CountDownLatch(2);
        var release = new CountDownLatch(1);
        var active = new AtomicInteger();
        var peak = new AtomicInteger();
        Callable<Integer> slow = () -> {
            int count = active.incrementAndGet(); peak.accumulateAndGet(count, Math::max); started.countDown();
            try { release.await(); return count; } finally { active.decrementAndGet(); }
        };
        try (var executor = new RemoteModuleExecutor(Duration.ofSeconds(5));
             var first = executor.submit("ssl", slow); var second = executor.submit("observatory", slow)) {
            assertTrue(started.await(2, TimeUnit.SECONDS));
            try (var third = executor.submit("ssl", slow); var fourth = executor.submit("observatory", slow);
                 var rejected = executor.submit("ssl", slow)) {
                assertThrows(RejectedExecutionException.class, rejected::await);
                release.countDown();
                first.await(); second.await(); third.await(); fourth.await();
                assertEquals(2, peak.get());
            } finally { release.countDown(); }
        }
    }
    @Test void deadlineCancelsTheCallAndLateResultCannotOverwriteAnything() throws Exception {
        var interrupted = new CountDownLatch(1);
        try (var executor = new RemoteModuleExecutor(Duration.ofMillis(100));
             var task = executor.submit("ssl", () -> {
                 try { new CountDownLatch(1).await(); return "late"; }
                 catch (InterruptedException stopped) { interrupted.countDown(); throw stopped; }
             })) {
            assertThrows(HttpTimeoutException.class, task::await);
            assertTrue(interrupted.await(2, TimeUnit.SECONDS));
        }
    }
    @Test void closingThePoolInterruptsRunningCallsAndRejectsNewWork() throws Exception {
        var started = new CountDownLatch(1);
        var stopped = new CountDownLatch(1);
        var executor = new RemoteModuleExecutor(Duration.ofSeconds(5));
        try (var task = executor.submit("ssl", () -> {
            started.countDown();
            try { new CountDownLatch(1).await(); return "unexpected"; }
            finally { stopped.countDown(); }
        })) {
            assertTrue(started.await(2, TimeUnit.SECONDS));
            executor.close();
            assertTrue(stopped.await(2, TimeUnit.SECONDS));
            try (var rejected = executor.submit("observatory", () -> "unexpected")) {
                assertThrows(RejectedExecutionException.class, rejected::await);
            }
        } finally { executor.close(); }
    }
    @Test void invalidBudgetsAndBrowserModulesAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> new RemoteModuleExecutor(Duration.ZERO));
        try (var executor = new RemoteModuleExecutor(Duration.ofSeconds(1))) {
            assertThrows(IllegalArgumentException.class, () -> executor.submit("runtime", () -> null));
        }
    }
}
