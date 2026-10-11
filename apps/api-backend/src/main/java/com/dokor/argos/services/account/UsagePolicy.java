package com.dokor.argos.services.account;

import com.typesafe.config.Config;
import jakarta.inject.*;
import java.time.*;
import java.util.*;

/** Offers are deployment configuration, independent of authorization roles. */
@Singleton
public class UsagePolicy {
    private final ZoneId zone;
    private final Map<String, Long> limits;
    @Inject public UsagePolicy(Config config) {
        zone = ZoneId.of(config.hasPath("usage.timezone") ? config.getString("usage.timezone") : "UTC");
        var values = new HashMap<String, Long>();
        if (config.hasPath("usage.offers")) {
            var offers = config.getConfig("usage.offers");
            for (String offer : offers.root().keySet()) {
                if (!offer.matches("[A-Z][A-Z0-9_]{0,15}")) throw new IllegalArgumentException("Invalid usage offer");
                var item = offers.getConfig(offer);
                if (item.hasPath("monthly-limit")) {
                    long limit = item.getLong("monthly-limit");
                    if (limit < 0 || item.getDouble("monthly-limit") != limit) throw new IllegalArgumentException("Invalid usage limit");
                    values.put(offer, limit);
                }
            }
        }
        limits = Map.copyOf(values);
    }
    public ZoneId zone() { return zone; }
    public Long limit(String offer) { return limits.get(offer); }
    public YearMonth period(Instant at) { return YearMonth.from(at.atZone(zone)); }
    public Instant start(YearMonth month) { return month.atDay(1).atStartOfDay(zone).toInstant(); }
    public Instant reset(YearMonth month) { return start(month.plusMonths(1)); }
}
