package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.analysis.AuditModule;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.inject.*;

import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;

/** Account administration. Every entry point rechecks the current role in its transaction. */
@Singleton
public class AdminService {
    public record Page(List<Map<String, Object>> items, String nextCursor) {}

    public record Entitlement(
            String offer,
            Long monthlyLimit,
            Long expectedVersion,
            com.dokor.argos.services.connected.contract.ConnectedContracts.AdminReason reasonCode,
            boolean confirmation) {}

    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final UsageService usage;
    private final UsagePolicy policy;
    private final ReportReadService reports;
    private final ObjectMapper mapper;
    private final Clock clock;

    @Inject
    public AdminService(
            AccountDao dao,
            AccountSessionService sessions,
            UsageService usage,
            UsagePolicy policy,
            ReportReadService reports,
            ObjectMapper mapper,
            Clock clock) {
        this.dao = dao;
        this.sessions = sessions;
        this.usage = usage;
        this.policy = policy;
        this.reports = reports;
        this.mapper = mapper;
        this.clock = clock;
    }

    private <T> T read(String auth, BiFunction<AccountSessionService.Context, Connection, T> work) {
        return sessions.with(
                auth,
                null,
                true,
                false,
                (ctx, c) -> {
                    requireAdmin(ctx);
                    return work.apply(ctx, c);
                });
    }

    public static void requireAdmin(AccountSessionService.Context ctx) {
        if (!"ACTIVE".equals(ctx.user().getState()) || !"ADMIN".equals(ctx.user().getRole()))
            throw AccountError.forbidden("admin_required");
    }

    public static long id(String value) {
        try {
            if (value == null || !value.matches("[1-9][0-9]{0,18}"))
                throw new IllegalArgumentException();
            return Long.parseLong(value);
        } catch (IllegalArgumentException e) {
            throw new AccountError(400, "filter_invalid");
        }
    }

    private static void page(
            int limit, String cursor, List<Object> args, StringBuilder sql, String column) {
        if (limit < 1 || limit > 100) throw new AccountError(400, "limit_invalid");
        if (cursor != null) {
            sql.append(" AND ").append(column).append("<?");
            args.add(id(cursor));
        }
        sql.append(" ORDER BY ").append(column).append(" DESC LIMIT ?");
        args.add(limit + 1);
    }

    private static void choice(String value, Set<String> allowed) {
        if (value != null && !allowed.contains(value))
            throw new AccountError(400, "filter_invalid");
    }

    private static void equal(StringBuilder sql, List<Object> args, String column, Object value) {
        if (value != null) {
            sql.append(" AND ").append(column).append("=?");
            args.add(value);
        }
    }

    static List<Map<String, Object>> query(Connection c, String sql, List<Object> args) {
        try (var s = c.prepareStatement(sql)) {
            for (int i = 0; i < args.size(); i++) s.setObject(i + 1, args.get(i));
            try (var r = s.executeQuery()) {
                var rows = new ArrayList<Map<String, Object>>();
                var meta = r.getMetaData();
                while (r.next()) {
                    var row = new LinkedHashMap<String, Object>();
                    for (int i = 1; i <= meta.getColumnCount(); i++) {
                        String key = meta.getColumnLabel(i);
                        Object value = r.getObject(i);
                        if (value instanceof Timestamp t) value = t.toInstant().toString();
                        if (key.equals("id") || key.endsWith("Id"))
                            value = value == null ? null : value.toString();
                        row.put(key, value);
                    }
                    rows.add(row);
                }
                return rows;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Administration query failed", e);
        }
    }

    private static Page result(List<Map<String, Object>> rows, int limit) {
        boolean more = rows.size() > limit;
        if (more) rows.removeLast();
        return new Page(rows, more ? rows.getLast().get("id").toString() : null);
    }

    public Page users(
            String auth, String search, String state, String offer, int limit, String cursor) {
        return read(
                auth,
                (ctx, c) -> {
                    choice(state, Set.of("ACTIVE", "PENDING", "SUSPENDED", "ARCHIVED"));
                    if (offer != null && !policy.offers().contains(offer))
                        throw new AccountError(400, "filter_invalid");
                    var sql =
                            new StringBuilder(
                                    "SELECT id,email,display_name AS"
                                        + " displayName,state,role,offer,admin_version AS"
                                        + " version,created_at AS createdAt,(SELECT monthly_limit"
                                        + " FROM ARG_USAGE_ACCOUNT WHERE id=ARG_ACCOUNT_USER.id) AS"
                                        + " monthlyLimit FROM ARG_ACCOUNT_USER WHERE 1=1");
                    var args = new ArrayList<Object>();
                    if (search != null && !search.isBlank()) {
                        if (search.length() > 100) throw new AccountError(400, "filter_invalid");
                        sql.append(
                                " AND (LOCATE(LOWER(?),LOWER(display_name))>0 OR"
                                        + " LOCATE(LOWER(?),LOWER(email))>0)");
                        args.add(search.strip());
                        args.add(search.strip());
                    }
                    equal(sql, args, "state", state);
                    equal(sql, args, "offer", offer);
                    page(limit, cursor, args, sql, "id");
                    var rows = query(c, sql.toString(), args);
                    var result = result(rows, limit);
                    attachUsage(rows, c);
                    capabilities(rows, ctx);
                    return result;
                });
    }

    public Map<String, Object> user(String auth, long id) {
        return read(
                auth,
                (ctx, c) -> {
                    var rows =
                            query(
                                    c,
                                    "SELECT id,email,display_name AS"
                                        + " displayName,state,role,offer,admin_version AS"
                                        + " version,created_at AS createdAt,(SELECT monthly_limit"
                                        + " FROM ARG_USAGE_ACCOUNT WHERE id=ARG_ACCOUNT_USER.id) AS"
                                        + " monthlyLimit FROM ARG_ACCOUNT_USER WHERE id=?",
                                    List.of(id));
                    if (rows.isEmpty()) throw AccountError.missing();
                    attachUsage(rows, c);
                    capabilities(rows, ctx);
                    return rows.getFirst();
                });
    }

    /**
     * One grouped ledger read for a bounded page; no account/usage locks on other administrators.
     */
    private void attachUsage(List<Map<String, Object>> rows, Connection c) {
        if (rows.isEmpty()) return;
        var month = policy.period(clock.instant());
        var args = new ArrayList<Object>();
        args.add(month.toString());
        rows.forEach(row -> args.add(row.get("id")));
        var counts =
                query(
                        c,
                        "SELECT user_id AS userId,SUM(state='COUNTED' AND period=?) AS"
                                + " used,SUM(state='RESERVED') AS reserved FROM ARG_USAGE_RUN WHERE"
                                + " user_id IN ("
                                + String.join(",", Collections.nCopies(rows.size(), "?"))
                                + ") GROUP BY user_id",
                        args);
        var byId = new HashMap<String, Map<String, Object>>();
        counts.forEach(r -> byId.put(r.get("userId").toString(), r));
        for (var row : rows) {
            var count = byId.get(row.get("id"));
            long used = count == null ? 0 : ((Number) count.get("used")).longValue(),
                    reserved = count == null ? 0 : ((Number) count.get("reserved")).longValue();
            String offer = row.get("offer").toString();
            Long limit =
                    row.get("monthlyLimit") == null
                            ? policy.limit(offer)
                            : Long.valueOf(((Number) row.get("monthlyLimit")).longValue());
            row.put(
                    "usage",
                    new UsageService.Snapshot(
                            offer,
                            month.toString(),
                            policy.zone().getId(),
                            policy.start(month).toString(),
                            policy.reset(month).toString(),
                            used,
                            reserved,
                            limit,
                            limit == null ? null : Math.max(0, limit - used - reserved),
                            limit == null || used + reserved < limit));
        }
    }

    private static void capabilities(
            List<Map<String, Object>> rows, AccountSessionService.Context ctx) {
        for (var row : rows) {
            boolean archived = "ARCHIVED".equals(row.get("state")),
                    admin = "ADMIN".equals(row.get("role")),
                    self = ctx.user().getId().toString().equals(row.get("id"));
            row.put("canEditEntitlement", !archived && (!admin || self));
            row.put("canSuspend", !archived && !admin && !self);
        }
    }

    public Map<String, Object> options(String auth) {
        return read(
                auth,
                (ctx, c) -> {
                    var limits = new ArrayList<Map<String, Object>>();
                    for (String offer : policy.offers()) {
                        var item = new LinkedHashMap<String, Object>();
                        item.put("offer", offer);
                        item.put("monthlyLimit", policy.limit(offer));
                        limits.add(item);
                    }
                    return Map.of(
                            "offers",
                            policy.offers(),
                            "offerLimits",
                            limits,
                            "reasonCodes",
                            com.dokor.argos.services.connected.contract.ConnectedContracts
                                    .AdminReason.values(),
                            "maximumMonthlyLimit",
                            9007199254740991L);
                });
    }

    private AccountUser target(
            AccountSessionService.Context ctx,
            long id,
            Long expectedVersion,
            Connection c,
            boolean suspension) {
        var target = dao.user(id, c, false);
        if (target == null) throw AccountError.missing();
        // Do not acquire cross-admin locks. Roles are provisioned outside this API.
        if ("ADMIN".equals(target.getRole()) && (suspension || !ctx.user().getId().equals(id)))
            throw AccountError.forbidden("admin_target");
        if (suspension && ctx.user().getId().equals(id))
            throw AccountError.forbidden("admin_target");
        target = dao.user(id, c, true);
        if (target == null) throw AccountError.missing();
        if ("ARCHIVED".equals(target.getState())) throw AccountError.forbidden("account_archived");
        if (!Objects.equals(target.getAdminVersion(), expectedVersion))
            throw new AccountError(409, "version_conflict");
        return target;
    }

    private static void input(Long version, Object reason, boolean confirmed) {
        if (!confirmed
                || reason == null
                || version == null
                || version < 0
                || version >= 9007199254740991L) throw new AccountError(400, "payload_invalid");
    }

    private AdminEvent event(
            AccountSessionService.Context ctx, AccountUser target, Long limit, Object reason) {
        var e = new AdminEvent();
        e.setActorId(ctx.user().getId());
        e.setTargetId(target.getId());
        e.setOldOffer(target.getOffer());
        e.setOldLimit(limit);
        e.setOldState(target.getState());
        e.setReasonCode(reason.toString());
        e.setRequestId(UUID.randomUUID().toString());
        e.setCreatedAt(clock.instant());
        return e;
    }

    private Map<String, Object> save(
            AccountUser target, AdminEvent event, Long limit, Connection c) {
        target.setAdminVersion(target.getAdminVersion() + 1);
        dao.save(target, c);
        event.setNewOffer(target.getOffer());
        event.setNewLimit(limit);
        event.setNewState(target.getState());
        dao.save(event, QAdminEvent.table, c);
        dao.transactions
                .delete(QAdminEvent.table, c)
                .where(QAdminEvent.table.createdAt.lt(clock.instant().minus(Duration.ofDays(90))))
                .execute();
        return Map.of("changed", true, "version", target.getAdminVersion());
    }

    public Map<String, Object> entitlement(String auth, String csrf, long id, Entitlement body) {
        if (csrf == null) throw AccountError.forbidden("csrf_invalid");
        return sessions.with(
                auth,
                csrf,
                true,
                true,
                (ctx, c) -> {
                    requireAdmin(ctx);
                    sessions.recent(ctx);
                    if (body == null) throw new AccountError(400, "payload_invalid");
                    input(body.expectedVersion(), body.reasonCode(), body.confirmation());
                    if (body.offer() == null
                            || !policy.offers().contains(body.offer())
                            || body.monthlyLimit() != null
                                    && (body.monthlyLimit() < 0
                                            || body.monthlyLimit() > 9007199254740991L))
                        throw new AccountError(400, "payload_invalid");
                    var target = target(ctx, id, body.expectedVersion(), c, false);
                    var snapshot = usage.snapshot(id, target.getOffer(), c);
                    Long oldLimit = usage.override(id, c);
                    Long next =
                            body.monthlyLimit() == null
                                    ? policy.limit(body.offer())
                                    : body.monthlyLimit();
                    if (next != null
                            && (snapshot.used() > next
                                    || snapshot.reserved() > next - snapshot.used()))
                        throw new AccountError(409, "quota_below_committed");
                    if (Objects.equals(target.getOffer(), body.offer())
                            && Objects.equals(oldLimit, body.monthlyLimit()))
                        return Map.of("changed", false, "version", target.getAdminVersion());
                    var event = event(ctx, target, oldLimit, body.reasonCode());
                    target.setOffer(body.offer());
                    usage.setOverride(id, body.monthlyLimit(), c);
                    return save(target, event, body.monthlyLimit(), c);
                });
    }

    public Map<String, Object> suspension(
            String auth,
            String csrf,
            long id,
            com.dokor.argos.services.connected.contract.ConnectedContracts.SuspensionInput body) {
        if (csrf == null) throw AccountError.forbidden("csrf_invalid");
        return sessions.with(
                auth,
                csrf,
                true,
                true,
                (ctx, c) -> {
                    requireAdmin(ctx);
                    sessions.recent(ctx);
                    if (body == null) throw new AccountError(400, "payload_invalid");
                    input(
                            body.expectedVersion(),
                            body.reasonCode(),
                            Boolean.TRUE.equals(body.confirmation()));
                    var target = target(ctx, id, body.expectedVersion(), c, true);
                    usage.lock(id, c);
                    Long limit = usage.override(id, c);
                    if (body.suspended() == "SUSPENDED".equals(target.getState()))
                        return Map.of("changed", false, "version", target.getAdminVersion());
                    var event = event(ctx, target, limit, body.reasonCode());
                    if (body.suspended()) {
                        target.setSuspendedFrom(target.getState());
                        target.setState("SUSPENDED");
                        sessions.revokeAll(id, null, c);
                        var tokens = QAccountToken.table;
                        dao.transactions
                                .update(tokens, c)
                                .set(tokens.consumedAt, clock.instant())
                                .where(tokens.userId.eq(id), tokens.consumedAt.isNull())
                                .execute();
                        var oauth = QAccountOauth.table;
                        dao.transactions
                                .update(oauth, c)
                                .set(oauth.consumedAt, clock.instant())
                                .where(oauth.userId.eq(id), oauth.consumedAt.isNull())
                                .execute();
                    } else {
                        target.setState(
                                "ACTIVE".equals(target.getSuspendedFrom()) ? "ACTIVE" : "PENDING");
                        target.setSuspendedFrom(null);
                    }
                    return save(target, event, limit, c);
                });
    }

    public Map<String, Object> queue(String auth) {
        return read(
                auth,
                (ctx, c) ->
                        query(
                                        c,
                                        "SELECT COUNT(CASE WHEN status='QUEUED' THEN 1 END) AS"
                                            + " queued,COUNT(CASE WHEN status='RUNNING' THEN 1 END)"
                                            + " AS running FROM ARG_AUDIT_RUN WHERE status IN"
                                            + " ('QUEUED','RUNNING')",
                                        List.of())
                                .getFirst());
    }

    private static final String RUNS =
            "SELECT r.id,r.owner_user_id AS userId,d.hostname AS site,CASE WHEN r.ci_navigation_origins IS NULL THEN a.normalized_url ELSE NULL END AS rawTarget,"
                + " u.id AS resolvedUserId,u.display_name AS userDisplayName,u.email AS userEmail,"
                + " bp.batch_id AS batchId,b.selected_count AS pageCount,r.status,r.created_at AS"
                + " createdAt,r.started_at AS startedAt,r.finished_at AS finishedAt,r.attempt_count"
                + " AS attempts,(r.ci_navigation_origins IS NULL AND EXISTS(SELECT 1 FROM ARG_AUDIT_REPORT p WHERE p.run_id=r.id AND"
                + " (p.expires_at IS NULL OR p.expires_at>UTC_TIMESTAMP(3)))) AS reportAvailable"
                + " FROM ARG_AUDIT_RUN r JOIN ARG_AUDIT a ON a.id=r.audit_id LEFT JOIN ARG_DOMAIN d"
                + " ON d.id=a.domain_id LEFT JOIN ARG_ACCOUNT_USER u ON u.id=r.owner_user_id AND u.state<>'ARCHIVED'"
                + " LEFT JOIN ARG_DOMAIN_BATCH_PAGE bp ON bp.run_id=r.id"
                + " LEFT JOIN ARG_DOMAIN_BATCH b ON b.id=bp.batch_id WHERE 1=1";

    private static void projectRuns(List<Map<String, Object>> rows) {
        for (var row : rows) {
            String site = AdminDisplayUrl.host((String) row.get("site"));
            row.put("displayUrl", AdminDisplayUrl.project((String) row.remove("rawTarget"), site));
            row.put("site", site);
        }
    }

    /** Bounded lookup options, independently searchable and paginated. */
    public Page runOptions(String auth, String kind, String search, int limit, String cursor) {
        return read(auth, (ctx, c) -> {
            choice(kind, Set.of("site", "user"));
            if (kind == null || search != null && (search.length() > 100 || search.matches("(?s).*[\\x00-\\x1f\\x7f].*")))
                throw new AccountError(400, "filter_invalid");
            boolean users = kind.equals("user");
            var sql = new StringBuilder(users
                    ? "SELECT id,display_name AS displayName,email FROM ARG_ACCOUNT_USER WHERE state<>'ARCHIVED'"
                    : "SELECT id,hostname AS site FROM ARG_DOMAIN WHERE 1=1");
            var args = new ArrayList<Object>();
            if (search != null && !search.isBlank()) {
                sql.append(users ? " AND (LOCATE(LOWER(?),LOWER(display_name))>0 OR LOCATE(LOWER(?),LOWER(email))>0)"
                        : " AND LOCATE(LOWER(?),LOWER(hostname))>0");
                args.add(search.strip());
                if (users) args.add(search.strip());
            }
            page(limit, cursor, args, sql, "id");
            var result = result(query(c, sql.toString(), args), limit);
            if (!users) result.items().forEach(row -> row.put("site", AdminDisplayUrl.host((String) row.get("site"))));
            return result;
        });
    }

    public Page runs(
            String auth,
            String user,
            String site,
            String status,
            String from,
            String until,
            int limit,
            String cursor) {
        return read(
                auth,
                (ctx, c) -> {
                    choice(status, Set.of("QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"));
                    var sql = new StringBuilder(RUNS);
                    var args = new ArrayList<Object>();
                    if ("anonymous".equals(user)) sql.append(" AND r.owner_user_id IS NULL");
                    else if (user != null) equal(sql, args, "r.owner_user_id", id(user));
                    if (site != null) {
                        if (site.length() > 253 || !site.matches("[a-zA-Z0-9.:-]+"))
                            throw new AccountError(400, "filter_invalid");
                        equal(sql, args, "d.hostname", site.toLowerCase(Locale.ROOT));
                    }
                    equal(sql, args, "r.status", status);
                    try {
                        Instant start =
                                from == null
                                        ? null
                                        : LocalDate.parse(from)
                                                .atStartOfDay(ZoneOffset.UTC)
                                                .toInstant();
                        Instant end =
                                until == null
                                        ? null
                                        : LocalDate.parse(until)
                                                .plusDays(1)
                                                .atStartOfDay(ZoneOffset.UTC)
                                                .toInstant();
                        if (start != null && end != null && !start.isBefore(end))
                            throw new IllegalArgumentException();
                        if (start != null) {
                            sql.append(" AND r.created_at>=?");
                            args.add(Timestamp.from(start));
                        }
                        if (end != null) {
                            sql.append(" AND r.created_at<?");
                            args.add(Timestamp.from(end));
                        }
                    } catch (java.time.DateTimeException | IllegalArgumentException e) {
                        throw new AccountError(400, "filter_invalid");
                    }
                    page(limit, cursor, args, sql, "r.id");
                    var result = result(query(c, sql.toString(), args), limit);
                    projectRuns(result.items());
                    return result;
                });
    }

    public Map<String, Object> run(String auth, long id) {
        return read(
                auth,
                (ctx, c) -> {
                    var rows = query(c, RUNS + " AND r.id=?", List.of(id));
                    if (rows.isEmpty()) throw AccountError.missing();
                    var row = rows.getFirst();
                    projectRuns(rows);
                    if (row.get("batchId") != null) {
                        var pages = query(c, RUNS + " AND bp.batch_id=? ORDER BY r.id LIMIT 1000", List.of(row.get("batchId")));
                        projectRuns(pages);
                        row.put("batchPages", pages.stream().map(p -> {
                            var page = new LinkedHashMap<String, Object>();
                            page.put("id", p.get("id")); page.put("displayUrl", p.get("displayUrl"));
                            return page;
                        }).toList());
                    }
                    var extra =
                            query(
                                            c,
                                            "SELECT module_statuses AS modules FROM ARG_AUDIT_RUN"
                                                    + " WHERE id=?",
                                            List.of(id))
                                    .getFirst();
                    var modules = new LinkedHashMap<String, String>();
                    try {
                        var node = mapper.readTree(Objects.toString(extra.get("modules"), "{}"));
                        for (var module : AuditModule.ordered()) {
                            String key = module.id();
                            String state = node.path(key).asText();
                            if (node.isArray())
                                for (var item : node)
                                    if (key.equals(item.path("id").asText())) {
                                        state = item.path("status").asText();
                                        break;
                                    }
                            if (Set.of(
                                            "PENDING",
                                            "RUNNING",
                                            "COMPLETED",
                                            "FAILED",
                                            "SKIPPED",
                                            "TIMEOUT")
                                    .contains(state)) modules.put(key, state);
                        }
                    } catch (Exception ignored) {
                        /* Legacy invalid progress must never expose its raw contents. */
                    }
                    row.put("modules", modules);
                    row.put(
                            "failureCode",
                            "FAILED".equals(row.get("status")) ? "analysis_failed" : null);
                    return row;
                });
    }

    public Object report(String auth, long id) {
        return read(auth, (ctx, c) -> reports.getByRunId(id).orElseThrow(AccountError::missing));
    }

    public Page events(String auth, int limit, String cursor) {
        return events(auth, limit, cursor, null);
    }

    public Page events(String auth, int limit, String cursor, String target) {
        return read(
                auth,
                (ctx, c) -> {
                    // Resolve current identities in one query, after requireAdmin. Audit IDs stay immutable.
                    // Archived accounts stay unresolved, even before anonymization completes.
                    var sql = new StringBuilder(
                            "SELECT e.id,e.actor_id AS actorId,e.target_id AS targetId,"
                            + "actor.display_name AS actorDisplayName,actor.email AS actorEmail,"
                            + "target.display_name AS targetDisplayName,target.email AS targetEmail,"
                            + "e.old_offer AS oldOffer,e.new_offer AS newOffer,e.old_limit AS oldLimit,"
                            + "e.new_limit AS newLimit,e.old_state AS oldState,e.new_state AS newState,"
                            + "e.event_type AS eventType,e.old_enabled AS oldEnabled,e.new_enabled AS newEnabled,"
                            + "e.reason_code AS reasonCode,e.request_id AS requestId,e.created_at AS createdAt"
                            + " FROM ARG_ADMIN_EVENT e"
                            + " LEFT JOIN ARG_ACCOUNT_USER actor ON actor.id=e.actor_id AND actor.state<>'ARCHIVED'"
                            + " LEFT JOIN ARG_ACCOUNT_USER target ON target.id=e.target_id AND target.state<>'ARCHIVED'"
                            + " WHERE e.created_at>=?");
                    var args = new ArrayList<Object>();
                    args.add(Timestamp.from(clock.instant().minus(Duration.ofDays(90))));
                    if (target != null) equal(sql, args, "e.target_id", id(target));
                    page(limit, cursor, args, sql, "e.id");
                    return result(query(c, sql.toString(), args), limit);
                });
    }
}
