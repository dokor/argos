package com.dokor.argos.db.dao;

import static com.dokor.argos.db.dao.BatchDao.query;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.connected.batch.BatchState;

import jakarta.inject.*;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/** Bounded private reads. List views never read report/result JSON. */
@Singleton
public final class DomainSummaryDao {
    private final TransactionManagerQuerydsl tx;

    @Inject
    public DomainSummaryDao(TransactionManagerQuerydsl tx) {
        this.tx = tx;
    }

    public record Site(long id, String hostname, Long batchId) {}

    public record Row(
            long batchId,
            BatchState.Page state,
            Long score,
            boolean provisional,
            Long critical,
            Long important,
            String diagnostic,
            String modules) {}

    public ConnectedDomainDao.Slice<Site> sites(
            long owner, ConnectedDomainDao.Window w, String term, Connection c) {
        long total =
                query(
                                c,
                                "SELECT COUNT(*) FROM ARG_ACCOUNT_SITE s JOIN ARG_DOMAIN d ON"
                                    + " d.id=s.domain_id WHERE s.owner_user_id=? AND"
                                    + " LOCATE(LOWER(?),LOWER(d.hostname))>0",
                                r -> r.getLong(1),
                                owner,
                                term)
                        .getFirst();
        var rows =
                query(
                        c,
                        """
SELECT s.id,d.hostname,b.id batch_id FROM ARG_ACCOUNT_SITE s JOIN ARG_DOMAIN d ON d.id=s.domain_id
LEFT JOIN ARG_DOMAIN_BATCH b ON b.id=(SELECT x.id FROM ARG_DOMAIN_BATCH x WHERE x.site_id=s.id AND x.owner_user_id=s.owner_user_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
WHERE s.owner_user_id=? AND LOCATE(LOWER(?),LOWER(d.hostname))>0 ORDER BY b.created_at DESC,b.id DESC,d.hostname,s.id LIMIT ? OFFSET ?
""",
                        r ->
                                new Site(
                                        r.getLong("id"),
                                        r.getString("hostname"),
                                        nullable(r, "batch_id")),
                        owner,
                        term,
                        w.limit(),
                        w.offset());
        return new ConnectedDomainDao.Slice<>(rows, total);
    }

    public List<DomainBatch> batches(long owner, List<Long> ids, Connection c) {
        if (ids.isEmpty()) return List.of();
        var b = QDomainBatch.table;
        return tx.selectQuery(c)
                .select(b)
                .from(b)
                .where(b.ownerUserId.eq(owner), b.id.in(ids))
                .fetch();
    }

    public List<Row> pages(long owner, List<Long> ids, boolean detail, Instant now, Connection c) {
        if (ids.isEmpty()) return List.of();
        if (ids.size() > 100 || detail && ids.size() != 1)
            throw new IllegalArgumentException("Unbounded read");
        String extras =
                detail
                        ? "report.diagnostic_json,r.module_statuses"
                        : "NULL diagnostic_json,NULL module_statuses";
        var params = new ArrayList<Object>();
        params.add(Timestamp.from(now));
        params.add(owner);
        params.addAll(ids);
        return query(
                c,
                """
SELECT p.batch_id,p.id,p.discovery_page_id,p.run_id,a.normalized_url,r.status,p.completeness,u.state credit,
(report.id IS NOT NULL) report_available,r.created_at,r.started_at,r.finished_at,
report.global_score,report.provisional,report.critical_count,report.important_count,
"""
                        + extras
                        + """
 FROM ARG_DOMAIN_BATCH_PAGE p JOIN ARG_AUDIT_RUN r ON r.id=p.run_id AND r.owner_user_id=p.owner_user_id
JOIN ARG_AUDIT a ON a.id=p.audit_id JOIN ARG_USAGE_RUN u ON u.id=r.id AND u.user_id=p.owner_user_id
LEFT JOIN ARG_AUDIT_REPORT report ON report.run_id=r.id AND (report.expires_at IS NULL OR report.expires_at>?)
WHERE p.owner_user_id=? AND p.batch_id IN (
"""
                        + String.join(",", Collections.nCopies(ids.size(), "?"))
                        + ") ORDER BY p.batch_id,p.id",
                r ->
                        new Row(
                                r.getLong("batch_id"),
                                new BatchState.Page(
                                        r.getLong("id"),
                                        r.getLong("discovery_page_id"),
                                        r.getLong("run_id"),
                                        r.getString("normalized_url"),
                                        r.getString("status"),
                                        r.getString("completeness"),
                                        r.getString("credit"),
                                        r.getBoolean("report_available"),
                                        instant(r, "created_at"),
                                        instant(r, "started_at"),
                                        instant(r, "finished_at")),
                                nullable(r, "global_score"),
                                r.getBoolean("provisional"),
                                nullable(r, "critical_count"),
                                nullable(r, "important_count"),
                                r.getString("diagnostic_json"),
                                r.getString("module_statuses")),
                params.toArray());
    }

    public DomainDiscovery discovery(long owner, long id, Connection c) {
        var d = QDomainDiscovery.table;
        var row =
                tx.selectQuery(c)
                        .select(d)
                        .from(d)
                        .where(d.ownerUserId.eq(owner), d.id.eq(id))
                        .fetchOne();
        if (row == null) throw AccountError.missing();
        return row;
    }

    private static Long nullable(ResultSet r, String field) throws SQLException {
        long v = r.getLong(field);
        return r.wasNull() ? null : v;
    }

    private static Instant instant(ResultSet r, String field) throws SQLException {
        var t = r.getTimestamp(field);
        return t == null ? null : t.toInstant();
    }
}
