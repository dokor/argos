package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.connected.batch.BatchState;
import com.dokor.argos.services.token.TokenService;

import jakarta.inject.*;

import java.sql.*;
import java.time.Instant;
import java.util.*;

@Singleton
public final class BatchDao extends CrudDaoQuerydsl<DomainBatch> {
    private static final QDomainBatch B = QDomainBatch.table;
    private final TokenService tokens;

    @Inject
    public BatchDao(TransactionManagerQuerydsl tx, TokenService tokens) {
        super(tx, B);
        this.tokens = tokens;
    }

    public long nextId() {
        return generateIdentifier();
    }

    /**
     * Fresh reads after waiting for row locks; pooled connections restore their default on close.
     */
    public <T> T transaction(java.util.function.Function<Connection, T> work) {
        return transactionManager.executeAndReturn(
                c -> {
                    try {
                        c.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
                    } catch (SQLException e) {
                        throw failure(e);
                    }
                    return work.apply(c);
                });
    }

    public DomainBatch owned(long owner, long site, long id, Connection c) {
        var row =
                transactionManager
                        .selectQuery(c)
                        .select(B)
                        .from(B)
                        .where(B.id.eq(id), B.ownerUserId.eq(owner), B.siteId.eq(site))
                        .forUpdate()
                        .fetchOne();
        if (row == null) throw AccountError.missing();
        return row;
    }

    public DomainBatch lock(long id, Connection c) {
        return transactionManager
                .selectQuery(c)
                .select(B)
                .from(B)
                .where(B.id.eq(id))
                .forUpdate()
                .fetchOne();
    }

    public DomainBatch byKey(long owner, String key, Connection c) {
        return transactionManager
                .selectQuery(c)
                .select(B)
                .from(B)
                .where(B.ownerUserId.eq(owner), B.idempotencyKey.eq(key))
                .fetchOne();
    }

    public List<DomainBatch> active(long owner, Connection c) {
        return transactionManager
                .selectQuery(c)
                .select(B)
                .from(B)
                .where(B.activeOwnerId.eq(owner))
                .orderBy(B.createdAt.asc(), B.id.asc())
                .fetch();
    }

    public List<Long> activeIds() {
        return transaction(
                c ->
                        transactionManager
                                .selectQuery(c)
                                .select(B.id)
                                .from(B)
                                .where(B.status.in("QUEUED", "RUNNING"))
                                .orderBy(B.id.asc())
                                .limit(100)
                                .fetch());
    }

    public void insert(DomainBatch row, Connection c) {
        execute(
                c,
                """
INSERT INTO ARG_DOMAIN_BATCH(id,owner_user_id,site_id,discovery_id,idempotency_key,request_fingerprint,profile_id,profile_snapshot_json,selected_count,status,created_at)
VALUES(?,?,?,?,?,?,?,?,?,'QUEUED',?)
""",
                row.getId(),
                row.getOwnerUserId(),
                row.getSiteId(),
                row.getDiscoveryId(),
                row.getIdempotencyKey(),
                row.getRequestFingerprint(),
                row.getProfileId(),
                row.getProfileSnapshotJson(),
                row.getSelectedCount(),
                Timestamp.from(row.getCreatedAt()));
    }

    public void child(DomainBatch batch, long page, long audit, long run, Connection c) {
        execute(
                c,
                """
INSERT INTO ARG_DOMAIN_BATCH_PAGE(id,batch_id,owner_user_id,site_id,discovery_id,discovery_page_id,audit_id,run_id,created_at)
VALUES(?,?,?,?,?,?,?,?,?)
""",
                nextId(),
                batch.getId(),
                batch.getOwnerUserId(),
                batch.getSiteId(),
                batch.getDiscoveryId(),
                page,
                audit,
                run,
                Timestamp.from(batch.getCreatedAt()));
    }

    /**
     * Lock ALL runs before any release takes the usage lock; otherwise cancel/publication can
     * deadlock.
     */
    public List<BatchState.Page> pages(DomainBatch batch, Connection c, Instant now) {
        var p = QDomainBatchPage.table;
        var r = QAuditRun.auditRun;
        var ids =
                transactionManager
                        .selectQuery(c)
                        .select(p.runId)
                        .from(p)
                        .where(
                                p.batchId.eq(batch.getId()),
                                p.ownerUserId.eq(batch.getOwnerUserId()))
                        .orderBy(p.runId.asc())
                        .fetch();
        if (ids.isEmpty() || ids.size() > 50)
            throw new IllegalStateException("Batch children inconsistent");
        transactionManager
                .selectQuery(c)
                .select(r.id)
                .from(r)
                .where(r.id.in(ids), r.ownerUserId.eq(batch.getOwnerUserId()))
                .orderBy(r.id.asc())
                .forUpdate()
                .fetch();
        return query(
                c,
                """
SELECT p.id,p.discovery_page_id,p.run_id,a.normalized_url,r.status,p.completeness,u.state credit,
  (report.id IS NOT NULL AND (report.expires_at IS NULL OR report.expires_at>?)) report_available,
  r.created_at,r.started_at,r.finished_at
FROM ARG_DOMAIN_BATCH_PAGE p JOIN ARG_AUDIT_RUN r ON r.id=p.run_id AND r.owner_user_id=p.owner_user_id
JOIN ARG_AUDIT a ON a.id=p.audit_id JOIN ARG_USAGE_RUN u ON u.id=r.id AND u.user_id=p.owner_user_id
LEFT JOIN ARG_AUDIT_REPORT report ON report.run_id=r.id
WHERE p.batch_id=? AND p.owner_user_id=? ORDER BY p.run_id
""",
                v ->
                        new BatchState.Page(
                                v.getLong("id"),
                                v.getLong("discovery_page_id"),
                                v.getLong("run_id"),
                                v.getString("normalized_url"),
                                v.getString("status"),
                                v.getString("completeness"),
                                v.getString("credit"),
                                v.getBoolean("report_available"),
                                instant(v, "created_at"),
                                instant(v, "started_at"),
                                instant(v, "finished_at")),
                Timestamp.from(now),
                batch.getId(),
                batch.getOwnerUserId());
    }

    public BatchState.Snapshot reconcile(
            DomainBatch batch, List<BatchState.Page> pages, Connection c, Instant now) {
        var state =
                BatchState.from(
                        pages,
                        batch.getSelectedCount(),
                        Boolean.TRUE.equals(batch.getCancelRequested()),
                        !batch.getStatus().equals("QUEUED"),
                        now);
        byte[] fingerprint = tokens.sha256(state.signature());
        if (!Arrays.equals(fingerprint, batch.getProgressFingerprint())
                || !batch.getStatus().equals(state.status().name())) {
            execute(
                    c,
                    "UPDATE ARG_DOMAIN_BATCH SET"
                        + " status=?,finished_at=?,progress_fingerprint=?,version=version+1 WHERE"
                        + " id=?",
                    state.status().name(),
                    state.finishedAt() == null ? null : Timestamp.from(state.finishedAt()),
                    fingerprint,
                    batch.getId());
            batch.setStatus(state.status().name());
            batch.setFinishedAt(state.finishedAt());
            batch.setProgressFingerprint(fingerprint);
            batch.setVersion(batch.getVersion() + 1);
        }
        return state;
    }

    public void requestCancel(DomainBatch batch, Connection c) {
        if (!Boolean.TRUE.equals(batch.getCancelRequested())) {
            execute(
                    c,
                    "UPDATE ARG_DOMAIN_BATCH SET cancel_requested=TRUE,version=version+1 WHERE"
                        + " id=?",
                    batch.getId());
            batch.setCancelRequested(true);
            batch.setVersion(batch.getVersion() + 1);
        }
    }

    public String hostname(DomainBatch batch, Connection c) {
        return query(
                        c,
                        "SELECT d.hostname FROM ARG_ACCOUNT_SITE s JOIN ARG_DOMAIN d ON"
                            + " d.id=s.domain_id WHERE s.id=? AND s.owner_user_id=?",
                        v -> v.getString(1),
                        batch.getSiteId(),
                        batch.getOwnerUserId())
                .stream()
                .findFirst()
                .orElseThrow(AccountError::missing);
    }

    public interface Reader<T> {
        T read(ResultSet r) throws SQLException;
    }

    public static <T> List<T> query(Connection c, String sql, Reader<T> reader, Object... params) {
        try (var s = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) s.setObject(i + 1, params[i]);
            try (var r = s.executeQuery()) {
                var rows = new ArrayList<T>();
                while (r.next()) rows.add(reader.read(r));
                return rows;
            }
        } catch (SQLException e) {
            throw failure(e);
        }
    }

    public static void execute(Connection c, String sql, Object... params) {
        try (var s = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) s.setObject(i + 1, params[i]);
            s.executeUpdate();
        } catch (SQLException e) {
            throw failure(e);
        }
    }

    private static Instant instant(ResultSet r, String field) throws SQLException {
        var t = r.getTimestamp(field);
        return t == null ? null : t.toInstant();
    }

    private static IllegalStateException failure(SQLException e) {
        return new IllegalStateException("Batch storage unavailable", e);
    }
}
