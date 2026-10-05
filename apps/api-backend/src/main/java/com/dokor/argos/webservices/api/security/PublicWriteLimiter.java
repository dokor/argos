package com.dokor.argos.webservices.api.security;

import com.google.common.net.InetAddresses;
import com.typesafe.config.Config;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.Duration;
import java.util.*;
import java.util.function.LongSupplier;

/** Per-instance admission control. Only the transport peer is trusted, never forwarded headers. */
@Singleton
public class PublicWriteLimiter {
    public enum Route { AUDIT, NEWSLETTER }
    private static final long WINDOW = Duration.ofMinutes(15).toNanos();
    private static final long BURST = Duration.ofSeconds(10).toNanos();
    private static final int MAX_PEERS = 4096;
    private final LongSupplier clock;
    private final Set<String> trustedProxies;
    private final Map<String, Bucket> peers = new HashMap<>();
    private final EnumMap<Route, Bucket> global = new EnumMap<>(Route.class);
    private static final class Bucket {
        long windowStart, burstStart; int count, burstCount;
        Bucket(long now) { windowStart = burstStart = now; }
        void refresh(long now) {
            if (now - windowStart >= WINDOW) { windowStart = now; count = 0; }
            if (now - burstStart >= BURST) { burstStart = now; burstCount = 0; }
        }
        long retry(long now, int quota, int burst) {
            long delay = 0;
            if (count >= quota) delay = WINDOW - (now - windowStart);
            if (burstCount >= burst) delay = Math.max(delay, BURST - (now - burstStart));
            return delay;
        }
        void admit() { count++; burstCount++; }
    }
    @Inject public PublicWriteLimiter(Config config) {
        this(config.hasPath("public-write.trusted-proxies") ? config.getStringList("public-write.trusted-proxies") : List.of(), System::nanoTime);
    }
    PublicWriteLimiter(List<String> proxies, LongSupplier clock) {
        this.clock = clock;
        Set<String> canonical = new HashSet<>();
        for (String proxy : proxies) {
            if (!InetAddresses.isInetAddress(proxy)) throw new IllegalArgumentException("Trusted proxies must be literal IP addresses");
            canonical.add(InetAddresses.toAddrString(InetAddresses.forString(proxy)));
        }
        trustedProxies = Set.copyOf(canonical);
    }
    public String clientHint(String peer) { String ip = canonical(peer); return trustedProxies.contains(ip) ? null : ip; }
    private static String canonical(String peer) {
        return peer != null && InetAddresses.isInetAddress(peer) ? InetAddresses.toAddrString(InetAddresses.forString(peer)) : "unknown";
    }
    /** Zero admits; positive value is Retry-After in seconds. Checks and increments are atomic. */
    public synchronized long acquire(Route route, String peer) {
        long now = clock.getAsLong();
        Bucket shared = global.computeIfAbsent(route, ignored -> new Bucket(now));
        shared.refresh(now);
        int quota = route == Route.AUDIT ? 5 : 20;
        int burst = route == Route.AUDIT ? 2 : 5;
        long retry = shared.retry(now, quota * 4, burst * 2);
        String ip = canonical(peer);
        Bucket client = null;
        if (!trustedProxies.contains(ip)) {
            String key = route.name() + ":" + ip;
            if (!peers.containsKey(key) && peers.size() >= MAX_PEERS) {
                peers.entrySet().removeIf(entry -> now - entry.getValue().windowStart >= WINDOW);
                if (peers.size() >= MAX_PEERS) return 60;
            }
            client = peers.computeIfAbsent(key, ignored -> new Bucket(now));
            client.refresh(now);
            retry = Math.max(retry, client.retry(now, quota, burst));
        }
        if (retry > 0) return Math.max(1, (retry + 999_999_999L) / 1_000_000_000L);
        shared.admit();
        if (client != null) client.admit();
        return 0;
    }
}
