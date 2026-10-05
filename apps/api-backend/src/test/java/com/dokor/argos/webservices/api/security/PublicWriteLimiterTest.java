package com.dokor.argos.webservices.api.security;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;

class PublicWriteLimiterTest {
    @Test void burstWindowResetAndIndependentRoutes() {
        var time = new AtomicLong(); var limiter = new PublicWriteLimiter(List.of(), time::get);
        assertEquals(0, limiter.acquire(PublicWriteLimiter.Route.AUDIT, "127.0.0.1"));
        assertEquals(0, limiter.acquire(PublicWriteLimiter.Route.AUDIT, "127.0.0.1"));
        assertEquals(10, limiter.acquire(PublicWriteLimiter.Route.AUDIT, "127.0.0.1"));
        assertEquals(0, limiter.acquire(PublicWriteLimiter.Route.NEWSLETTER, "127.0.0.1"));
        time.addAndGet(Duration.ofSeconds(10).toNanos());
        for (int i=0;i<2;i++) assertEquals(0, limiter.acquire(PublicWriteLimiter.Route.AUDIT, "127.0.0.1"));
        time.addAndGet(Duration.ofSeconds(10).toNanos());
        assertEquals(0, limiter.acquire(PublicWriteLimiter.Route.AUDIT, "127.0.0.1"));
        assertEquals(880, limiter.acquire(PublicWriteLimiter.Route.AUDIT, "127.0.0.1"));
        time.set(Duration.ofMinutes(15).toNanos());
        assertEquals(0, limiter.acquire(PublicWriteLimiter.Route.AUDIT, "127.0.0.1"));
    }
    @Test void concurrentAdmissionsCannotExceedBurst() throws Exception {
        var limiter = new PublicWriteLimiter(List.of(), () -> 0L);
        try (var executor = Executors.newFixedThreadPool(12)) {
            var start = new CyclicBarrier(12); var accepted = new AtomicLong();
            var futures = new java.util.ArrayList<Future<?>>();
            for (int i=0;i<12;i++) futures.add(executor.submit(() -> { start.await(); if(limiter.acquire(PublicWriteLimiter.Route.AUDIT, "::1")==0) accepted.incrementAndGet(); return null; }));
            for (var future:futures) future.get(5, TimeUnit.SECONDS);
            assertEquals(2, accepted.get());
        }
    }
    @Test void onlyLiteralTrustedPeersShareGlobalQuotaAndCannotRemoveIt() {
        var limiter = new PublicWriteLimiter(List.of("127.0.0.1"), () -> 0L);
        assertNull(limiter.clientHint("127.0.0.1"));
        for(int i=0;i<4;i++) assertEquals(0, limiter.acquire(PublicWriteLimiter.Route.AUDIT,"127.0.0.1"));
        assertEquals(10, limiter.acquire(PublicWriteLimiter.Route.AUDIT,"127.0.0.1"));
        assertEquals("unknown", limiter.clientHint(null));
        assertThrows(IllegalArgumentException.class, () -> new PublicWriteLimiter(List.of("proxy.internal"), () -> 0L));
    }
}
