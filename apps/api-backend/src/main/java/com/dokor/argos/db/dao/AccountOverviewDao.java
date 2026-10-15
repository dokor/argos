package com.dokor.argos.db.dao;

import static com.dokor.argos.db.dao.BatchDao.query;

import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

import jakarta.inject.Singleton;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/** SQL aggregates before pagination; bounded page rows include a frozen diagnostic, never report bodies or raw evidence. */
@Singleton
public final class AccountOverviewDao {
    public record Filter(String attention, String query, Long domainId, int limit, long offset) {
        public Filter {
            if (attention != null && !Set.of("priority", "incomplete", "active").contains(attention)
                    || query != null
                            && (query.length() > 2048
                                    || query.chars().anyMatch(Character::isISOControl))
                    || domainId != null && domainId <= 0)
                throw new AccountError(400, "filter_invalid");
            new ConnectedDomainDao.Window(limit, offset);
            query = query == null ? "" : query;
        }
    }

    // The private relationship is unique for (owner, audit). Audit identity preserves normalized
    // queries.
    // Date then ID breaks ties, independently of batch membership or historical report
    // availability.
    private static final String PROJECTION =
            """
WITH latest AS (
 SELECT u.id page_id,s.id domain_id,d.hostname,a.normalized_url,r.id run_id,r.status,r.created_at,r.finished_at,r.module_statuses,
 p.id report_id,p.diagnostic_json,p.global_score,p.provisional,p.critical_count,p.important_count,p.measurement_completeness,
 CASE WHEN JSON_VALUE(p.diagnostic_json,'$.version')=1 AND JSON_VALUE(p.diagnostic_json,'$.available') IN ('true','1')
 THEN JSON_VALUE(p.diagnostic_json,'$.coverageRatio') END coverage_ratio,
 CASE WHEN JSON_VALUE(p.diagnostic_json,'$.version')=1 AND JSON_VALUE(p.diagnostic_json,'$.available') IN ('true','1')
 THEN JSON_VALUE(p.diagnostic_json,'$.coverageVersion') END coverage_version
 FROM ARG_ACCOUNT_SITE_URL u JOIN ARG_ACCOUNT_SITE s ON s.id=u.site_id
 JOIN ARG_DOMAIN d ON d.id=s.domain_id JOIN ARG_AUDIT a ON a.id=u.audit_id
 LEFT JOIN ARG_AUDIT_RUN r ON r.id=(SELECT x.id FROM ARG_AUDIT_RUN x
 WHERE x.owner_user_id=s.owner_user_id AND x.audit_id=u.audit_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
 LEFT JOIN ARG_AUDIT_REPORT p ON p.run_id=r.id AND r.status='COMPLETED' AND (p.expires_at IS NULL OR p.expires_at>?)
 WHERE s.owner_user_id=?
), projection AS (
 SELECT latest.*,
 (status='COMPLETED' AND report_id IS NOT NULL AND (critical_count>0 OR important_count>0)) priority,
 (run_id IS NULL OR (status NOT IN ('QUEUED','RUNNING') AND
 (status<>'COMPLETED' OR report_id IS NULL OR measurement_completeness IS NULL OR measurement_completeness<>'FULL' OR coverage_ratio IS NULL OR coverage_ratio<0 OR coverage_ratio>1 OR provisional IS NULL OR critical_count IS NULL OR important_count IS NULL))) incomplete
 FROM latest
)
""";

    public record Totals(long tracked, long priority, long incomplete) {}

    public Totals totals(long owner, Instant now, Connection c) {
        return query(
                        c,
                        PROJECTION
                                + "SELECT"
                                + " COUNT(*),COALESCE(SUM(priority),0),COALESCE(SUM(incomplete),0)"
                                + " FROM projection",
                        r -> new Totals(r.getLong(1), r.getLong(2), r.getLong(3)),
                        Timestamp.from(now),
                        owner)
                .getFirst();
    }

    public TrackedPages pages(long owner, Instant now, Filter f, Connection c) {
        if (f.domainId() != null
                && query(
                                c,
                                "SELECT id FROM ARG_ACCOUNT_SITE WHERE id=? AND owner_user_id=?",
                                r -> r.getLong(1),
                                f.domainId(),
                                owner)
                        .isEmpty()) throw AccountError.missing();
        String where =
                " WHERE LOCATE(LOWER(?),LOWER(normalized_url))>0"
                        + (f.domainId() == null ? "" : " AND domain_id=?")
                        + (f.attention() == null
                                ? ""
                                : switch (f.attention()) {
                                    case "priority" -> " AND priority=1";
                                    case "incomplete" -> " AND incomplete=1";
                                    default -> " AND status IN ('QUEUED','RUNNING')";
                                });
        var args = new ArrayList<Object>(List.of(Timestamp.from(now), owner, f.query()));
        if (f.domainId() != null) args.add(f.domainId());
        long total =
                query(
                                c,
                                PROJECTION + "SELECT COUNT(*) FROM projection" + where,
                                r -> r.getLong(1),
                                args.toArray())
                        .getFirst();
        args.add(f.limit());
        args.add(f.offset());
        var rows =
                query(
                        c,
                        PROJECTION
                                + "SELECT * FROM projection"
                                + where
                                + " ORDER BY COALESCE(priority,0) DESC,COALESCE(critical_count,-1)"
                                + " DESC,COALESCE(important_count,-1) DESC,normalized_url,page_id"
                                + " LIMIT ? OFFSET ?",
                        AccountOverviewDao::page,
                        args.toArray());
        // One bounded bulk lookup for the historical available reports, never one query per URL.
        if (!rows.isEmpty()) {
            var ids = rows.stream().map(TrackedPage::pageId).toList();
            var reports =
                    query(
                            c,
                            """
SELECT u.id page_id,p.run_id,p.created_at,p.expires_at,p.global_score,p.provisional
FROM ARG_ACCOUNT_SITE_URL u JOIN ARG_ACCOUNT_SITE s ON s.id=u.site_id
JOIN ARG_AUDIT_REPORT p ON p.id=(SELECT y.id FROM ARG_AUDIT_REPORT y JOIN ARG_AUDIT_RUN x ON x.id=y.run_id
WHERE x.owner_user_id=s.owner_user_id AND x.audit_id=u.audit_id AND x.status='COMPLETED'
AND (y.expires_at IS NULL OR y.expires_at>?) ORDER BY y.created_at DESC,y.id DESC LIMIT 1)
WHERE s.owner_user_id=? AND u.id IN (
"""
                                    + String.join(",", Collections.nCopies(ids.size(), "?"))
                                    + ")",
                            r ->
                                    Map.entry(
                                            r.getString("page_id"),
                                            new AvailableReport(
                                                    r.getString("run_id"),
                                                    date(r, "created_at"),
                                                    date(r, "expires_at"),
                                                    new Score(
                                                            number(r, "global_score"),
                                                            r.getBoolean("provisional"),
                                                            number(r, "global_score") == null
                                                                    ? "SCORE_UNAVAILABLE"
                                                                    : null))),
                            historicalArgs(owner, now, ids));
            var byId = new HashMap<String, AvailableReport>();
            reports.forEach(e -> byId.put(e.getKey(), e.getValue()));
            rows =
                    rows.stream()
                            .map(
                                    p ->
                                            new TrackedPage(
                                                    p.pageId(),
                                                    p.domainId(),
                                                    p.normalizedUrl(),
                                                    p.latestAttempt(),
                                                    byId.get(p.pageId()),
                                                    p.result(),
                                                    p.hostname()))
                            .toList();
        }
        return new TrackedPages(rows, total, (long) f.limit(), f.offset(), now.toString());
    }

    private static Object[] historicalArgs(long owner, Instant now, List<String> ids) {
        var a = new ArrayList<Object>(List.of(Timestamp.from(now), owner));
        a.addAll(ids);
        return a.toArray();
    }

    private static TrackedPage page(ResultSet r) throws SQLException {
        String id = r.getString("page_id"),
                run = r.getString("run_id"),
                status = r.getString("status");
        boolean published = r.getObject("report_id") != null;
        Double ratio = r.getObject("coverage_ratio") == null ? null : r.getDouble("coverage_ratio");
        if (ratio != null && (!Double.isFinite(ratio) || ratio < 0 || ratio > 1)) ratio = null;
        boolean known =
                published
                        && ratio != null
                        && r.getObject("provisional") != null
                        && r.getObject("critical_count") != null
                        && r.getObject("important_count") != null;
        String stored = r.getString("measurement_completeness");
        Completeness completeness =
                !published
                        ? Completeness.NONE
                        : !known || stored == null || !Set.of("FULL", "PARTIAL").contains(stored)
                                ? Completeness.UNKNOWN
                                : Completeness.valueOf(stored);
        String reason =
                published
                        ? (r.getObject("global_score") == null ? "SCORE_UNAVAILABLE" : null)
                        : run == null
                                ? "NEVER_ANALYZED"
                                : switch (status) {
                                    case "FAILED" -> "ANALYSIS_FAILED";
                                    case "CANCELED" -> "ANALYSIS_CANCELED";
                                    case "COMPLETED" -> "REPORT_UNAVAILABLE";
                                    default -> "ANALYSIS_PENDING";
                                };
        return new TrackedPage(
                id,
                r.getString("domain_id"),
                r.getString("normalized_url"),
                run == null
                        ? null
                        : new Attempt(
                                run,
                                ExecutionStatus.valueOf(status),
                                date(r, "created_at"),
                                date(r, "finished_at")),
                null,
                run == null
                        ? null
                        : new PageResult(
                                id,
                                r.getString("normalized_url"),
                                run,
                                ExecutionStatus.valueOf(status),
                                completeness,
                                new Score(
                                        published ? number(r, "global_score") : null,
                                        published && r.getBoolean("provisional"),
                                        reason),
                                new Coverage(ratio, r.getString("coverage_version")),
                                published ? number(r, "critical_count") : null,
                                published ? number(r, "important_count") : null,
                                com.dokor.argos.services.connected.summary.CollectionDiagnostics.modules(r.getString("module_statuses")),
                                "FAILED".equals(status) ? "ANALYSIS_FAILED" : null,
                                published,
                                com.dokor.argos.services.connected.summary.CollectionDiagnostics.gaps(r.getString("diagnostic_json"))),
                r.getString("hostname"));
    }

    private static final String RUNS =
            """
 FROM ARG_AUDIT_RUN r JOIN ARG_ACCOUNT_SITE s ON s.owner_user_id=r.owner_user_id
 JOIN ARG_ACCOUNT_SITE_URL u ON u.site_id=s.id AND u.audit_id=r.audit_id
 JOIN ARG_AUDIT a ON a.id=r.audit_id JOIN ARG_DOMAIN d ON d.id=s.domain_id WHERE r.owner_user_id=?
""";

    public long active(long owner, Connection c) {
        return query(
                        c,
                        "SELECT COUNT(*)" + RUNS + " AND r.status IN ('QUEUED','RUNNING')",
                        r -> r.getLong(1),
                        owner)
                .getFirst();
    }

    public List<RecentRun> runs(long owner, boolean active, Connection c) {
        return query(
                c,
                "SELECT r.id,r.status,r.created_at,r.finished_at,u.id page_id,s.id"
                        + " domain_id,a.normalized_url,d.hostname"
                        + RUNS
                        + (active ? " AND r.status IN ('QUEUED','RUNNING')" : "")
                        + " ORDER BY r.created_at DESC,r.id DESC LIMIT 10",
                r ->
                        new RecentRun(
                                new Attempt(
                                        r.getString("id"),
                                        ExecutionStatus.valueOf(r.getString("status")),
                                        date(r, "created_at"),
                                        date(r, "finished_at")),
                                r.getString("page_id"),
                                r.getString("domain_id"),
                                r.getString("normalized_url"),
                                r.getString("hostname")),
                owner);
    }

    private static Long number(ResultSet r, String f) throws SQLException {
        long v = r.getLong(f);
        return r.wasNull() ? null : v;
    }

    private static String date(ResultSet r, String f) throws SQLException {
        var v = r.getTimestamp(f);
        return v == null ? null : v.toInstant().toString();
    }
}
