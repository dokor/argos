package com.dokor.argos.services.account;

import com.dokor.argos.services.configuration.ConfigurationService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.Connection;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** Read-only observations of durable work. Never claims, reaps or reconciles a task. */
@Singleton
public final class AdminQueueService {
    public record Filters(String type, String status, String site, String user, String from,
                          String until, String sort, int page, int limit) {}
    public record Snapshot(List<Map<String, Object>> items, boolean hasMore, int page,
                           List<Map<String, Object>> counts, String snapshotAt, long stuckSeconds) {}

    private final AccountSessionService sessions;
    private final Clock clock;
    private final ConfigurationService configuration;

    @Inject
    public AdminQueueService(AccountSessionService sessions, Clock clock, ConfigurationService configuration) {
        this.sessions = sessions;
        this.clock = clock;
        this.configuration = configuration;
    }

    // Batch dates and child counts come from runs, not from the asynchronous reconciler's cache.
    // Explicit projection: claim/report tokens, parameters, raw errors and logs are never selected.
    private static final String SOURCE = """
        SELECT 'DISCOVERY' AS type,x.id,x.owner_user_id AS userId,d.hostname AS site,
          NULL AS rawTarget,x.status,x.created_at AS createdAt,x.started_at AS startedAt,
          x.finished_at AS finishedAt,x.lease_until AS leaseUntil,x.expires_at AS expiresAt,
          x.cancel_requested AS cancelRequested,0 AS attempts,NULL AS pageCount,NULL AS batchId,
          NULL AS childCount,NULL AS queuedChildren,NULL AS runningChildren,NULL AS oldestRunningAt
        FROM ARG_DOMAIN_DISCOVERY x JOIN ARG_ACCOUNT_SITE s ON s.id=x.site_id
        JOIN ARG_DOMAIN d ON d.id=s.domain_id
        UNION ALL
        SELECT 'BATCH',b.id,b.owner_user_id,d.hostname,NULL,b.status,b.created_at,p.startedAt,
          b.finished_at,NULL,NULL,b.cancel_requested,0,b.selected_count,NULL,
          COALESCE(p.childCount,0),COALESCE(p.queuedChildren,0),COALESCE(p.runningChildren,0),p.oldestRunningAt
        FROM ARG_DOMAIN_BATCH b JOIN ARG_ACCOUNT_SITE s ON s.id=b.site_id
        JOIN ARG_DOMAIN d ON d.id=s.domain_id LEFT JOIN (
          SELECT bp.batch_id,COUNT(*) AS childCount,MIN(r.started_at) AS startedAt,
            SUM(r.status='QUEUED') AS queuedChildren,SUM(r.status='RUNNING') AS runningChildren,
            MIN(CASE WHEN r.status='RUNNING' THEN r.started_at END) AS oldestRunningAt
          FROM ARG_DOMAIN_BATCH_PAGE bp JOIN ARG_AUDIT_RUN r ON r.id=bp.run_id GROUP BY bp.batch_id
        ) p ON p.batch_id=b.id
        UNION ALL
        SELECT 'RUN',r.id,r.owner_user_id,d.hostname,a.normalized_url,r.status,r.created_at,
          r.started_at,r.finished_at,NULL,NULL,FALSE,r.attempt_count,NULL,bp.batch_id,NULL,NULL,NULL,NULL
        FROM ARG_AUDIT_RUN r JOIN ARG_AUDIT a ON a.id=r.audit_id
        LEFT JOIN ARG_DOMAIN d ON d.id=a.domain_id LEFT JOIN ARG_DOMAIN_BATCH_PAGE bp ON bp.run_id=r.id
        """;
    private static final String TASKS = "SELECT t.*,u.id AS resolvedUserId,u.display_name AS userDisplayName,"
        + "u.email AS userEmail FROM (" + SOURCE + ") t LEFT JOIN ARG_ACCOUNT_USER u ON u.id=t.userId AND u.state<>'ARCHIVED' WHERE 1=1";

    private <T> T read(String auth, java.util.function.Function<Connection, T> work) {
        return sessions.with(auth, null, true, false, (ctx, c) -> {
            AdminService.requireAdmin(ctx);
            return work.apply(c);
        });
    }

    public Snapshot list(String auth, Filters filters) {
        return read(auth, c -> {
            validate(filters);
            Instant now = clock.instant();
            var sql = new StringBuilder(TASKS + " AND t.status IN ('QUEUED','RUNNING')");
            var args = new ArrayList<Object>();
            // The default hierarchy has one row per batch. The URL-only filter also exposes its children.
            if (!"RUN".equals(filters.type())) sql.append(" AND (t.type<>'RUN' OR t.batchId IS NULL OR NOT EXISTS"
                + " (SELECT 1 FROM ARG_DOMAIN_BATCH activeBatch WHERE activeBatch.id=t.batchId AND activeBatch.status IN ('QUEUED','RUNNING')))");
            equal(sql, args, "t.type", filters.type());
            equal(sql, args, "t.status", filters.status());
            equal(sql, args, "t.site", filters.site() == null ? null : filters.site().toLowerCase(Locale.ROOT));
            if ("anonymous".equals(filters.user())) sql.append(" AND t.userId IS NULL");
            else if (filters.user() != null) equal(sql, args, "t.userId", AdminService.id(filters.user()));
            if (filters.from() != null) {
                sql.append(" AND t.createdAt>=?"); args.add(day(filters.from()));
            }
            if (filters.until() != null) {
                sql.append(" AND t.createdAt<?"); args.add(Timestamp.from(day(filters.until()).toInstant().plus(Duration.ofDays(1))));
            }
            sql.append(switch (Objects.toString(filters.sort(), "oldest")) {
                case "newest" -> " ORDER BY t.createdAt DESC,t.type,t.id DESC";
                case "status" -> " ORDER BY t.status,t.createdAt,t.type,t.id";
                case "started" -> " ORDER BY t.startedAt IS NULL,t.startedAt,t.type,t.id";
                default -> " ORDER BY t.createdAt,t.type,t.id";
            });
            sql.append(" LIMIT ? OFFSET ?");
            args.add(filters.limit() + 1); args.add((filters.page() - 1) * filters.limit());
            var items = AdminService.query(c, sql.toString(), args);
            boolean more = items.size() > filters.limit();
            if (more) items.removeLast();
            items.forEach(row -> project(row, now));
            var counts = AdminService.query(c, """
                SELECT 'DISCOVERY' AS type,COUNT(CASE WHEN status='QUEUED' THEN 1 END) AS queued,
                  COUNT(CASE WHEN status='RUNNING' THEN 1 END) AS running FROM ARG_DOMAIN_DISCOVERY WHERE status IN ('QUEUED','RUNNING')
                UNION ALL SELECT 'BATCH',COUNT(CASE WHEN status='QUEUED' THEN 1 END),
                  COUNT(CASE WHEN status='RUNNING' THEN 1 END) FROM ARG_DOMAIN_BATCH WHERE status IN ('QUEUED','RUNNING')
                UNION ALL SELECT 'RUN',COUNT(CASE WHEN status='QUEUED' THEN 1 END),
                  COUNT(CASE WHEN status='RUNNING' THEN 1 END) FROM ARG_AUDIT_RUN WHERE status IN ('QUEUED','RUNNING')
                """, List.of());
            return new Snapshot(items, more, filters.page(), counts, now.toString(), configuration.auditStuckRunTimeout().toSeconds());
        });
    }

    /** Terminal rows remain inspectable after cancellation, completion or worker recovery. */
    public Map<String, Object> detail(String auth, String type, long id) {
        return read(auth, c -> {
            choice(type, Set.of("DISCOVERY", "BATCH", "RUN"));
            if (type == null) throw new AccountError(400, "filter_invalid");
            var rows = AdminService.query(c, TASKS + " AND t.type=? AND t.id=?", List.of(type, id));
            if (rows.isEmpty()) throw AccountError.missing();
            Instant now = clock.instant();
            var row = rows.getFirst();
            project(row, now);
            if (type.equals("BATCH")) {
                var children = AdminService.query(c, TASKS + " AND t.type='RUN' AND t.batchId=? ORDER BY t.createdAt,t.id LIMIT 50", List.of(id));
                children.forEach(child -> project(child, now));
                row.put("children", children);
            }
            row.put("snapshotAt", now.toString());
            row.put("stuckSeconds", configuration.auditStuckRunTimeout().toSeconds());
            return row;
        });
    }

    private void project(Map<String, Object> row, Instant now) {
        String host = AdminDisplayUrl.host((String) row.get("site"));
        row.put("site", host);
        row.put("displayUrl", AdminDisplayUrl.project((String) row.remove("rawTarget"), host));
        row.put("diagnostic", diagnostic(row, now, configuration.auditStuckRunTimeout()));
        Instant created = instant(row.get("createdAt")), started = instant(row.get("startedAt"));
        Instant finished = instant(row.get("finishedAt"));
        row.put("waitSeconds", created == null ? null : Math.max(0, Duration.between(created, started == null ? finished == null ? now : finished : started).toSeconds()));
        row.put("elapsedSeconds", started == null ? null : Math.max(0, Duration.between(started, Optional.ofNullable(instant(row.get("finishedAt"))).orElse(now)).toSeconds()));
    }

    static String diagnostic(Map<String, Object> row, Instant now, Duration timeout) {
        String status = Objects.toString(row.get("status")), type = Objects.toString(row.get("type"));
        if (!Set.of("QUEUED", "RUNNING").contains(status)) return "TERMINAL";
        if (Boolean.TRUE.equals(row.get("cancelRequested")) || row.get("cancelRequested") instanceof Number n && n.intValue() != 0) return "CANCEL_REQUESTED";
        Instant started = instant(row.get("startedAt"));
        if (type.equals("DISCOVERY")) {
            Instant lease = instant(row.get("leaseUntil")), expires = instant(row.get("expiresAt"));
            if (status.equals("RUNNING") && (started == null || lease == null)) return "INCONSISTENT";
            if (status.equals("RUNNING") && !lease.isAfter(now)) return "LEASE_EXPIRED";
            if (status.equals("QUEUED") && expires != null && !expires.isAfter(now)) return "EXPIRED";
        }
        if (type.equals("BATCH")) {
            long queued = number(row.get("queuedChildren")), running = number(row.get("runningChildren"));
            if (number(row.get("childCount")) != number(row.get("pageCount"))) return "INCONSISTENT";
            String observed = queued + running == 0 ? "TERMINAL" : started == null ? "QUEUED" : "RUNNING";
            if (!status.equals(observed)) return "RECONCILIATION_PENDING";
            Instant oldest = instant(row.get("oldestRunningAt"));
            if (running > 0 && oldest == null) return "INCONSISTENT";
            if (oldest != null && oldest.isBefore(now.minus(timeout))) return "STALE";
        }
        if (type.equals("RUN")) {
            if (status.equals("RUNNING") && started == null) return "INCONSISTENT";
            if (status.equals("RUNNING") && started.isBefore(now.minus(timeout))) return "STALE";
            if (status.equals("QUEUED") && number(row.get("attempts")) > 0) return "REQUEUED";
        }
        return "OBSERVED";
    }

    private static long number(Object value) { return value instanceof Number n ? n.longValue() : 0; }
    private static Instant instant(Object value) { return value == null ? null : Instant.parse(value.toString()); }
    private static Timestamp day(String date) { return Timestamp.from(LocalDate.parse(date).atStartOfDay(ZoneOffset.UTC).toInstant()); }
    private static void choice(String value, Set<String> choices) {
        if (value != null && !choices.contains(value)) throw new AccountError(400, "filter_invalid");
    }
    private static void equal(StringBuilder sql, List<Object> args, String column, Object value) {
        if (value != null) { sql.append(" AND ").append(column).append("=?"); args.add(value); }
    }
    static void validate(Filters f) {
        choice(f.type(), Set.of("DISCOVERY", "BATCH", "RUN"));
        choice(f.status(), Set.of("QUEUED", "RUNNING"));
        choice(f.sort(), Set.of("oldest", "newest", "status", "started"));
        if (f.limit() < 1 || f.limit() > 100 || f.page() < 1 || f.page() > 10000) throw new AccountError(400, "limit_invalid");
        if (f.user() != null && !f.user().equals("anonymous")) AdminService.id(f.user());
        if (f.site() != null && (f.site().length() > 253 || !f.site().matches("[a-zA-Z0-9.:-]+"))) throw new AccountError(400, "filter_invalid");
        try {
            if (f.from() != null) day(f.from());
            if (f.until() != null) day(f.until());
            if (f.from() != null && f.until() != null && day(f.from()).after(day(f.until()))) throw new IllegalArgumentException();
        } catch (DateTimeException | IllegalArgumentException e) { throw new AccountError(400, "filter_invalid"); }
    }
}
