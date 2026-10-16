package com.dokor.argos.services.analytics;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.typesafe.config.Config;
import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.Objects;
import java.util.UUID;
import java.util.Calendar;
import java.util.TimeZone;

/** Shared durable switch. Deployment permission remains an independent hard gate. */
@Singleton
public class ProductMeasurementControl {
    public record State(boolean enabled, boolean requestedEnabled, boolean deploymentAllowed,
                        long version, Instant lastCollectedAt) {}
    public record Change(Boolean enabled, Long expectedVersion, Boolean confirmation) {}
    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final Clock clock;
    private final boolean deploymentAllowed;

    @Inject public ProductMeasurementControl(AccountDao dao, AccountSessionService sessions, Clock clock, Config config) {
        this.dao = dao; this.sessions = sessions; this.clock = clock;
        deploymentAllowed = config.hasPath("product-analytics.enabled") && config.getBoolean("product-analytics.enabled");
    }

    public State read(String auth) {
        return sessions.with(auth, null, true, false, (ctx, c) -> {
            AdminService.requireAdmin(ctx);
            return state(load(c));
        });
    }

    private ProductSetting load(Connection c) {
        // Explicit UTC calendars match the telemetry DAO, independent of the JVM timezone.
        try (var query = c.prepareStatement("SELECT enabled,version,enabled_since,last_collected_at FROM ARG_PRODUCT_SETTING WHERE id=1 FOR UPDATE");
                var result = query.executeQuery()) {
            if (!result.next()) throw new AccountError(503, "measurement_unavailable");
            var row = new ProductSetting(); row.setId(1L);
            row.setEnabled(result.getBoolean(1)); row.setVersion(result.getLong(2));
            Timestamp since = result.getTimestamp(3, utc()), last = result.getTimestamp(4, utc());
            row.setEnabledSince(since == null ? null : since.toInstant());
            row.setLastCollectedAt(last == null ? null : last.toInstant());
            return row;
        } catch (SQLException e) { throw new AccountError(503, "measurement_unavailable"); }
    }
    private static Calendar utc() { return Calendar.getInstance(TimeZone.getTimeZone("UTC")); }

    private void save(ProductSetting row, Connection c) {
        try (var query = c.prepareStatement("UPDATE ARG_PRODUCT_SETTING SET enabled=?,version=?,enabled_since=? WHERE id=1")) {
            query.setBoolean(1, row.getEnabled()); query.setLong(2, row.getVersion());
            query.setTimestamp(3, row.getEnabledSince() == null ? null : Timestamp.from(row.getEnabledSince()), utc());
            if (query.executeUpdate() != 1) throw new AccountError(503, "measurement_unavailable");
        } catch (SQLException e) { throw new AccountError(503, "measurement_unavailable"); }
    }
    private State state(ProductSetting row) {
        return new State(deploymentAllowed && Boolean.TRUE.equals(row.getEnabled()), Boolean.TRUE.equals(row.getEnabled()),
                deploymentAllowed, row.getVersion(), row.getLastCollectedAt());
    }

    public State change(String auth, String csrf, Change body) {
        if (csrf == null) throw AccountError.forbidden("csrf_invalid");
        return sessions.with(auth, csrf, true, true, (ctx, c) -> {
            AdminService.requireAdmin(ctx);
            if (body == null || body.enabled() == null || !Boolean.TRUE.equals(body.confirmation())
                    || body.expectedVersion() == null || body.expectedVersion() < 0 || body.expectedVersion() >= 9007199254740991L)
                throw new AccountError(400, "payload_invalid");
            if (body.enabled() && !deploymentAllowed) throw new AccountError(409, "measurement_blocked");
            var row = load(c);
            if (!Objects.equals(row.getVersion(), body.expectedVersion())) throw new AccountError(409, "version_conflict");
            if (Objects.equals(row.getEnabled(), body.enabled())) return state(row);
            var event = new AdminEvent();
            event.setActorId(ctx.user().getId()); event.setEventType("PRODUCT_MEASUREMENT");
            event.setOldEnabled(row.getEnabled()); event.setNewEnabled(body.enabled());
            event.setCreatedAt(clock.instant()); event.setRequestId(UUID.randomUUID().toString());
            row.setEnabled(body.enabled()); row.setVersion(row.getVersion() + 1);
            row.setEnabledSince(body.enabled() ? clock.instant() : null);
            save(row, c);
            dao.save(event, QAdminEvent.table, c);
            dao.transactions.delete(QAdminEvent.table, c).where(QAdminEvent.table.createdAt.lt(clock.instant().minus(Duration.ofDays(90)))).execute();
            return state(row);
        });
    }
}
