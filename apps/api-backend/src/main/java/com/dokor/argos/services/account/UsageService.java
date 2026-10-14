package com.dokor.argos.services.account;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditRun;
import jakarta.inject.*;
import jakarta.ws.rs.core.Response;
import java.sql.*;
import java.time.*;
import java.util.*;

/** A per-owner lock serializes admissions, publication and claim without locking sessions. */
@Singleton
public class UsageService {
    public record Snapshot(String offer, String period, String timezone, String startsAt,
            String resetsAt, long used, long reserved, Long limit, Long available, boolean canLaunch) {}
    private final TransactionManagerQuerydsl transactions;
    private final UsagePolicy policy;
    private final Clock clock;
    @Inject public UsageService(TransactionManagerQuerydsl transactions, UsagePolicy policy, Clock clock) {
        this.transactions=transactions; this.policy=policy; this.clock=clock;
    }
    public <T> T transaction(java.util.function.Function<Connection,T> work) {
        return transactions.executeAndReturn(work::apply);
    }
    public void lock(long user, Connection c) {
        execute(c,"INSERT INTO ARG_USAGE_ACCOUNT(id) VALUES(?) ON DUPLICATE KEY UPDATE id=VALUES(id)",user);
        try(var s=c.prepareStatement("SELECT id FROM ARG_USAGE_ACCOUNT WHERE id=? FOR UPDATE")) {
            s.setLong(1,user);try(var r=s.executeQuery()) { if(!r.next()) throw new IllegalStateException("Usage lock missing"); }
        } catch(SQLException e) { throw new IllegalStateException("Usage lock failed",e); }
    }
    private String offer(long user, Connection c) {
        return offer(user,c,true);
    }
    private String offer(long user, Connection c, boolean locked) {
        // Snapshot/admission take account -> usage. Publication never calls this method.
        try(var s=c.prepareStatement("SELECT offer FROM ARG_ACCOUNT_USER WHERE id=?"+(locked ? " FOR UPDATE":""))) {
            s.setLong(1,user);try(var r=s.executeQuery()) { if(!r.next()) throw AccountError.missing();return r.getString(1); }
        } catch(SQLException e) { throw new IllegalStateException("Usage offer unavailable",e); }
    }
    public Snapshot snapshot(long user, String offer, Connection c) {
        offer=offer(user,c); // Current effective offer, even after waiting behind an administrative change.
        lock(user,c);
        return snapshot(user,offer,c,true);
    }
    /** Consistent MVCC read in the caller's transaction, without taking another account's locks. */
    public Snapshot readSnapshot(long user, Connection c) {
        return snapshot(user,offer(user,c,false),c,false);
    }
    private Snapshot snapshot(long user, String offer, Connection c, boolean locked) {
        YearMonth month=policy.period(clock.instant());
        long used=0,reserved=0;
        try(var s=c.prepareStatement("SELECT state,COUNT(*) FROM ARG_USAGE_RUN WHERE user_id=? AND (state='RESERVED' OR (state='COUNTED' AND period=?)) GROUP BY state"+(locked ? " FOR UPDATE":""))) {
            s.setLong(1,user);s.setString(2,month.toString());
            try(var r=s.executeQuery()) { while(r.next()) { if(r.getString(1).equals("COUNTED")) used=r.getLong(2);else reserved=r.getLong(2); } }
        } catch(SQLException e) { throw new IllegalStateException("Usage unavailable",e); }
        Long override=override(user,c,locked);
        Long limit=override==null ? policy.limit(offer) : override;
        return new Snapshot(offer,month.toString(),policy.zone().getId(),policy.start(month).toString(),policy.reset(month).toString(),used,reserved,limit,limit==null ? null : used>=limit || reserved>=limit-used ? 0L : limit-used-reserved,limit==null || used<limit && reserved<limit-used);
    }
    public void admit(long user, Connection c) { admitMany(user,1,c); }
    /** F07 must call this before inserting any of the N children on this SAME transaction. */
    public void admitMany(long user, int count, Connection c) {
        if(count<1 || count>100) throw new AccountError(400,"selection_invalid");
        var view=snapshot(user,offer(user,c),c);
        if(view.available()!=null && view.available()<count) {
            long retry=Math.max(1,Duration.between(clock.instant(),Instant.parse(view.resetsAt())).getSeconds());
            throw new jakarta.ws.rs.WebApplicationException(Response.status(429).type("application/json")
                .header("Cache-Control","private, no-store").header("Retry-After",retry)
                .entity(Map.of("error","quota_exceeded","resetsAt",view.resetsAt().toString())).build());
        }
    }
    /** Called after admission, in the transaction that inserts the queued run. */
    public void reserve(AuditRun run, Connection c) {
        if(run.getOwnerUserId()==null) return;
        lock(run.getOwnerUserId(),c);
        execute(c,"INSERT INTO ARG_USAGE_RUN(id,user_id,period,state,created_at) VALUES(?,?,?,'RESERVED',?)",
            run.getId(),run.getOwnerUserId(),policy.period(clock.instant()).toString(),Timestamp.from(clock.instant()));
    }
    /** Publication already locks the run. Never acquire the account/session lock here. */
    public void published(AuditRun run, Instant publishedAt, Connection c) {
        if(run.getOwnerUserId()==null) return;
        lock(run.getOwnerUserId(),c);
        execute(c,"INSERT INTO ARG_USAGE_RUN(id,user_id,period,state,created_at,counted_at) VALUES(?,?,?,'COUNTED',?,?) "
            +"ON DUPLICATE KEY UPDATE period=IF(state='RESERVED',VALUES(period),period), counted_at=IF(state='RESERVED',VALUES(counted_at),counted_at), state=IF(state='RESERVED','COUNTED',state)",
            run.getId(),run.getOwnerUserId(),policy.period(publishedAt).toString(),Timestamp.from(run.getCreatedAt()),Timestamp.from(publishedAt));
    }
    public void release(AuditRun run, Connection c) {
        if(run.getOwnerUserId()==null) return;
        lock(run.getOwnerUserId(),c);
        execute(c,"UPDATE ARG_USAGE_RUN SET state='RELEASED',released_at=? WHERE id=? AND state='RESERVED'",Timestamp.from(clock.instant()),run.getId());
    }
    /** Completed anonymous reports are counted at their original publication, without a new launch. */
    public void claimed(AuditRun run, Instant publishedAt, Connection c) {
        if(publishedAt!=null) published(run,publishedAt,c);
        else if(List.of("QUEUED","RUNNING").contains(run.getStatus())) { admit(run.getOwnerUserId(),c);reserve(run,c); }
    }
    public Long override(long user, Connection c) {
        return override(user,c,true);
    }
    public Long readOverride(long user, Connection c) { return override(user,c,false); }
    private Long override(long user, Connection c, boolean locked) {
        try(var s=c.prepareStatement("SELECT monthly_limit FROM ARG_USAGE_ACCOUNT WHERE id=?"+(locked ? " FOR UPDATE":""))) {
            s.setLong(1,user);try(var r=s.executeQuery()) { return r.next() ? r.getObject(1,Long.class) : null; }
        } catch(SQLException e) { throw new IllegalStateException("Usage limit unavailable",e); }
    }
    /** Caller holds the same usage lock used by admission/publication. */
    public void setOverride(long user, Long limit, Connection c) {
        execute(c,"UPDATE ARG_USAGE_ACCOUNT SET monthly_limit=? WHERE id=?",limit,user);
    }
    private static void execute(Connection c,String sql,Object... values) {
        try(var s=c.prepareStatement(sql)) { for(int i=0;i<values.length;i++) s.setObject(i+1,values[i]);s.executeUpdate(); }
        catch(SQLException e) { throw new IllegalStateException("Usage persistence failed",e); }
    }
}
