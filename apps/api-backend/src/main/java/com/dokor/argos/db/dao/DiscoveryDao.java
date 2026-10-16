package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.connected.discovery.*;

import jakarta.inject.*;

import java.sql.*;
import java.time.Instant;
import java.util.*;

@Singleton
public final class DiscoveryDao extends CrudDaoQuerydsl<DomainDiscovery> {
    private static final QDomainDiscovery D = QDomainDiscovery.table;

    @Inject
    public DiscoveryDao(TransactionManagerQuerydsl transactions) {
        super(transactions, D);
    }

    public <T> T transaction(java.util.function.Function<Connection, T> work) {
        return transactionManager.executeAndReturn(work::apply);
    }

    public long nextId() {
        return generateIdentifier();
    }

    public void gate(Connection c) {
        try (var s = c.prepareStatement("SELECT id FROM ARG_DISCOVERY_GATE WHERE id=1 FOR UPDATE");
                var r = s.executeQuery()) {
            if (!r.next()) throw new IllegalStateException("Discovery gate missing");
        } catch (SQLException e) {
            throw failure(e);
        }
    }

    public DomainDiscovery owned(long owner, long id, Connection c, boolean lock) {
        var q =
                transactionManager
                        .selectQuery(c)
                        .select(D)
                        .from(D)
                        .where(D.id.eq(id), D.ownerUserId.eq(owner));
        var row = (lock ? q.forUpdate() : q).fetchOne();
        if (row == null) throw AccountError.missing();
        return row;
    }

    public DomainDiscovery byKey(long owner, String key, Connection c) {
        return transactionManager
                .selectQuery(c)
                .select(D)
                .from(D)
                .where(D.ownerUserId.eq(owner), D.idempotencyKey.eq(key))
                .fetchOne();
    }

    public List<DomainDiscovery> active(long owner, Connection c) {
        return transactionManager
                .selectQuery(c)
                .select(D)
                .from(D)
                .where(D.ownerUserId.eq(owner), D.status.in("QUEUED", "RUNNING"))
                .fetch();
    }

    public List<DomainDiscovery> resumable(long owner, Instant now, Connection c) {
        var b = QDomainBatch.table;
        return transactionManager.selectQuery(c).select(D).from(D)
                .where(D.ownerUserId.eq(owner), D.expiresAt.gt(now),
                    D.status.in("QUEUED", "RUNNING").or(D.status.eq("COMPLETED").and(
                        com.querydsl.sql.SQLExpressions.selectOne().from(b)
                            .where(b.discoveryId.eq(D.id), b.ownerUserId.eq(owner)).notExists())))
                .orderBy(D.status.eq("COMPLETED").asc(), D.createdAt.desc(), D.id.desc()).limit(100).fetch();
    }

    public void insert(DomainDiscovery row, Connection c) {
        execute(
                c,
                "INSERT INTO"
                    + " ARG_DOMAIN_DISCOVERY(id,owner_user_id,site_id,idempotency_key,request_fingerprint,status,parameters_json,effective_limits_json,created_at,expires_at)"
                    + " VALUES(?,?,?,?,?,'QUEUED',?,?,?,?)",
                row.getId(),
                row.getOwnerUserId(),
                row.getSiteId(),
                row.getIdempotencyKey(),
                row.getRequestFingerprint(),
                row.getParametersJson(),
                row.getEffectiveLimitsJson(),
                Timestamp.from(row.getCreatedAt()),
                Timestamp.from(row.getExpiresAt()));
    }

    public long activeCount(Connection c) {
        return transactionManager
                .selectQuery(c)
                .select(D.id.count())
                .from(D)
                .where(D.status.in("QUEUED", "RUNNING"))
                .forUpdate()
                .fetchOne();
    }

    /**
     * Gate is shared across processes. Claim never takes an account/session lock after a discovery
     * lock.
     */
    public DomainDiscovery claim(DiscoveryPolicy policy, Instant now) {
        return transaction(
                c -> {
                    gate(c);
                    reap(c, now);
                    if (transactionManager
                                    .selectQuery(c)
                                    .select(D.id.count())
                                    .from(D)
                                    .where(D.status.eq("RUNNING"))
                                    .fetchOne()
                            >= policy.workers) return null;
                    String sql =
                            "SELECT d.id FROM ARG_DOMAIN_DISCOVERY d JOIN ARG_ACCOUNT_SITE s ON"
                                + " s.id=d.site_id JOIN ARG_ACCOUNT_USER u ON u.id=d.owner_user_id"
                                + " WHERE d.status='QUEUED' AND u.state='ACTIVE' AND d.expires_at>?"
                                + " AND NOT EXISTS (SELECT 1 FROM ARG_DOMAIN_DISCOVERY own WHERE"
                                + " own.owner_user_id=d.owner_user_id AND own.status='RUNNING')"
                                + " AND (SELECT COUNT(*) FROM ARG_DOMAIN_DISCOVERY x JOIN"
                                + " ARG_ACCOUNT_SITE xs ON xs.id=x.site_id WHERE x.status='RUNNING'"
                                + " AND xs.domain_id=s.domain_id)<? ORDER BY COALESCE((SELECT MAX(h.started_at)"
                                + " FROM ARG_DOMAIN_DISCOVERY h WHERE h.owner_user_id=d.owner_user_id),"
                                + " '1970-01-01'),d.created_at,d.id"
                                + " LIMIT 1";
                    try (var statement = c.prepareStatement(sql)) {
                        statement.setTimestamp(1, Timestamp.from(now));
                        statement.setInt(2, policy.perHost);
                        try (var r = statement.executeQuery()) {
                            if (!r.next()) return null;
                            long id = r.getLong(1);
                            String token = UUID.randomUUID().toString();
                            if (execute(
                                            c,
                                            """
                                            UPDATE ARG_DOMAIN_DISCOVERY SET
                                              status='RUNNING',
                                              effective_limits_json=JSON_SET(effective_limits_json,
                                                '$.maxUrls',LEAST(JSON_VALUE(effective_limits_json,'$.maxUrls'),?),
                                                '$.maxDepth',LEAST(JSON_VALUE(effective_limits_json,'$.maxDepth'),?),
                                                '$.durationSeconds',LEAST(JSON_VALUE(effective_limits_json,'$.durationSeconds'),?),
                                                '$.requestsPerHost',LEAST(JSON_VALUE(effective_limits_json,'$.requestsPerHost'),?)),
                                              started_at=?,
                                              lease_until=TIMESTAMPADD(SECOND,JSON_VALUE(effective_limits_json,'$.durationSeconds')+5,?),
                                              claim_token=?,version=version+1
                                            WHERE id=? AND status='QUEUED'
                                            """,
                                            policy.maxUrls,
                                            policy.maxDepth,
                                            policy.seconds,
                                            policy.perHost,
                                            Timestamp.from(now),
                                            Timestamp.from(now),
                                            token,
                                            id)
                                    != 1) return null;
                            return transactionManager
                                    .selectQuery(c)
                                    .select(D)
                                    .from(D)
                                    .where(D.id.eq(id))
                                    .fetchOne();
                        }
                    } catch (SQLException e) {
                        throw failure(e);
                    }
                });
    }

    public void reap(Connection c, Instant now) {
        execute(
                c,
                "UPDATE ARG_DOMAIN_DISCOVERY SET"
                    + " status=IF(cancel_requested,'CANCELED','FAILED'),finished_at=?,stop_reason=IF(cancel_requested,'CANCELED','WORKER_LOST'),truncated=TRUE,version=version+1"
                    + " WHERE status='RUNNING' AND lease_until<=?",
                Timestamp.from(now),
                Timestamp.from(now));
        // A joined UPDATE would lock account rows after the gate, reversing admission's order.
        var user = QAccountUser.table;
        var unavailable =
                transactionManager
                        .selectQuery(c)
                        .select(D.id)
                        .from(D)
                        .join(user)
                        .on(user.id.eq(D.ownerUserId))
                        .where(D.status.eq("QUEUED"), user.state.ne("ACTIVE"))
                        .fetch();
        for (long id : unavailable)
            execute(
                    c,
                    "UPDATE ARG_DOMAIN_DISCOVERY SET"
                        + " status='CANCELED',finished_at=?,stop_reason='ACCOUNT_UNAVAILABLE',cancel_requested=TRUE,version=version+1"
                        + " WHERE id=? AND status='QUEUED'",
                    Timestamp.from(now),
                    id);
        execute(
                c,
                "UPDATE ARG_DOMAIN_DISCOVERY SET"
                    + " status='FAILED',finished_at=?,stop_reason='EXPIRED',version=version+1 WHERE"
                    + " status='QUEUED' AND expires_at<=?",
                Timestamp.from(now),
                Timestamp.from(now));
    }

    public boolean canceled(DomainDiscovery job, Instant now) {
        return transaction(
                c -> {
                    try (var s =
                            c.prepareStatement(
                                    "SELECT"
                                        + " d.status,d.cancel_requested,d.claim_token,d.lease_until,u.state"
                                        + " FROM ARG_DOMAIN_DISCOVERY d JOIN ARG_ACCOUNT_USER u ON"
                                        + " u.id=d.owner_user_id WHERE d.id=?")) {
                        s.setLong(1, job.getId());
                        try (var r = s.executeQuery()) {
                            return !r.next()
                                    || !"RUNNING".equals(r.getString(1))
                                    || r.getBoolean(2)
                                    || !job.getClaimToken().equals(r.getString(3))
                                    || !r.getTimestamp(4).toInstant().isAfter(now)
                                    || !"ACTIVE".equals(r.getString(5));
                        }
                    } catch (SQLException e) {
                        throw failure(e);
                    }
                });
    }

    public void page(DomainDiscovery job, DomainCrawler.Page page, Instant now) {
        transaction(
                c -> {
                    var row = owned(job.getOwnerUserId(), job.getId(), c, true);
                    if (!"RUNNING".equals(row.getStatus())
                            || !job.getClaimToken().equals(row.getClaimToken())
                            || !row.getLeaseUntil().isAfter(now))
                        throw new DiscoveryStop("CANCELED");
                    execute(
                            c,
                            "INSERT INTO"
                                + " ARG_DOMAIN_DISCOVERY_PAGE(id,discovery_id,owner_user_id,site_id,normalized_url,source,depth,eligible,exclusion_reason)"
                                + " VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE"
                                + " eligible=VALUES(eligible),exclusion_reason=VALUES(exclusion_reason)",
                            nextId(),
                            job.getId(),
                            job.getOwnerUserId(),
                            job.getSiteId(),
                            page.url(),
                            page.source().name(),
                            page.depth(),
                            page.eligible(),
                            page.reason());
                    execute(
                            c,
                            "UPDATE ARG_DOMAIN_DISCOVERY SET eligible_count=(SELECT COUNT(*) FROM"
                                + " ARG_DOMAIN_DISCOVERY_PAGE WHERE discovery_id=? AND"
                                + " eligible=TRUE),excluded_count=(SELECT COUNT(*) FROM"
                                + " ARG_DOMAIN_DISCOVERY_PAGE WHERE discovery_id=? AND"
                                + " eligible=FALSE),version=version+1 WHERE id=?",
                            job.getId(),
                            job.getId(),
                            job.getId());
                    return null;
                });
    }

    public void finish(DomainDiscovery job, DomainCrawler.Result result, Instant now) {
        transaction(
                c -> {
                    var row = owned(job.getOwnerUserId(), job.getId(), c, true);
                    if (!"RUNNING".equals(row.getStatus())
                            || !job.getClaimToken().equals(row.getClaimToken())
                            || !row.getLeaseUntil().isAfter(now)) return null;
                    boolean cancel =
                            Boolean.TRUE.equals(row.getCancelRequested())
                                    || result.reason().equals("CANCELED");
                    String status =
                            cancel
                                    ? "CANCELED"
                                    : row.getEligibleCount() == 0 ? "FAILED" : "COMPLETED";
                    execute(
                            c,
                            "UPDATE ARG_DOMAIN_DISCOVERY SET"
                                + " status=?,finished_at=?,stop_reason=?,truncated=?,version=version+1"
                                + " WHERE id=?",
                            status,
                            Timestamp.from(now),
                            cancel ? "CANCELED" : result.reason(),
                            result.truncated(),
                            row.getId());
                    return null;
                });
    }

    public void cancel(DomainDiscovery row, Instant now, Connection c) {
        if (!Set.of("QUEUED", "RUNNING").contains(row.getStatus())) return;
        execute(
                c,
                "UPDATE ARG_DOMAIN_DISCOVERY SET"
                    + " cancel_requested=TRUE,version=version+1,finished_at=IF(status='QUEUED',?,NULL),stop_reason=IF(status='QUEUED','CANCELED',stop_reason),status=IF(status='QUEUED','CANCELED',status)"
                    + " WHERE id=?",
                Timestamp.from(now),
                row.getId());
    }

    public static int execute(Connection c, String sql, Object... values) {
        try (var s = c.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) s.setObject(i + 1, values[i]);
            return s.executeUpdate();
        } catch (SQLException e) {
            throw failure(e);
        }
    }

    private static IllegalStateException failure(SQLException e) {
        return new IllegalStateException("Discovery storage unavailable", e);
    }
}
