package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.CiErrorCode;
import jakarta.inject.*;
import java.net.URI;
import java.sql.*;
import java.time.Instant;
import java.util.*;

/** Metadata reads never select report_json/result_json, claims or credentials. */
@Singleton
public class CiRequestDao extends CrudDaoQuerydsl<CiRequest> {
    private final TransactionManagerQuerydsl tx;
    @Inject public CiRequestDao(TransactionManagerQuerydsl tx){super(tx,QCiRequest.table);this.tx=tx;}
    public CiRequest byKey(CiKeysService.Context identity,byte[] key,Connection c) {
        var q=QCiRequest.table;return tx.selectQuery(c).select(q).from(q)
            .where(q.ownerUserId.eq(identity.owner()),q.integrationId.eq(identity.integrationId()),q.idempotencyHash.eq(key)).fetchOne();
    }
    public CiRequest byId(CiKeysService.Context identity,String id,Connection c) {
        var q=QCiRequest.table;return tx.selectQuery(c).select(q).from(q)
            .where(q.ownerUserId.eq(identity.owner()),q.integrationId.eq(identity.integrationId()),q.publicId.eq(id)).fetchOne();
    }
    /** Existing URL identities remain shared; owned requests/runs are always separate. */
    public long audit(String url,Instant now,Connection c) {
        String host=URI.create(url).getHost();
        Long domain=id(c,"SELECT id FROM ARG_DOMAIN WHERE hostname=?",host);
        if(domain==null) {domain=generateIdentifier();insert(c,"INSERT INTO ARG_DOMAIN(id,hostname,created_at) VALUES(?,?,?)",domain,host,Timestamp.from(now));}
        Long audit=id(c,"SELECT id FROM ARG_AUDIT WHERE normalized_url=?",url);
        if(audit==null) {audit=generateIdentifier();insert(c,"INSERT INTO ARG_AUDIT(id,domain_id,input_url,normalized_url,created_at) VALUES(?,?,?,?,?)",audit,domain,url,url,Timestamp.from(now));}
        return audit;
    }
    private Long id(Connection c,String sql,String key) {
        try(var s=c.prepareStatement(sql)){s.setString(1,key);try(var r=s.executeQuery()){return r.next()?r.getLong(1):null;}}
        catch(SQLException failed){throw new IllegalStateException("CI URL identity unavailable");}
    }
    private void insert(Connection c,String sql,Object... values) {
        try(var s=c.prepareStatement(sql)){for(int n=0;n<values.length;n++)s.setObject(n+1,values[n]);s.executeUpdate();}
        catch(SQLException failed){
            // A concurrent legacy admission can win an identity insert. Roll back, never hold
            // an UPDATE lock on its shared audit while waiting for the global queue semaphore.
            if(failed.getErrorCode()==1062)throw CiRateService.limited(CiErrorCode.CAPACITY_UNAVAILABLE,1);
            throw new IllegalStateException("CI URL identity unavailable");
        }
    }
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
    public record Run(String id,int sample,String status,String createdAt,String startedAt,String finishedAt,String failureCode) {}
    public List<Run> runs(CiRequest request,Connection c) {
        var result=new ArrayList<Run>();
        try(var s=c.prepareStatement("SELECT r.id,u.ci_sample,r.status,r.created_at,r.started_at,r.finished_at FROM ARG_USAGE_RUN u JOIN ARG_AUDIT_RUN r ON r.id=u.id WHERE u.ci_intent_id=? AND u.ci_integration_id=? AND u.user_id=? AND r.owner_user_id=? AND r.ci_navigation_origins IS NOT NULL ORDER BY u.ci_sample LIMIT 2")) {
            s.setString(1,request.getPublicId());s.setLong(2,request.getIntegrationId());s.setLong(3,request.getOwnerUserId());s.setLong(4,request.getOwnerUserId());
            try(var r=s.executeQuery()){while(r.next()){
                String status=r.getString(3);
                if(!Set.of("QUEUED","RUNNING","COMPLETED","FAILED","CANCELED").contains(status))throw new IllegalStateException("CI status invalid");
                result.add(new Run(r.getString(1),r.getInt(2),status,iso(r.getTimestamp(4)),iso(r.getTimestamp(5)),iso(r.getTimestamp(6)),"FAILED".equals(status)?"RUN_FAILED":null));
            }}
        }catch(SQLException failed){throw new IllegalStateException("CI progress unavailable");}
        if(result.size()!=request.getSamples())throw new IllegalStateException("CI admission incomplete");return List.copyOf(result);
    }
    public CiRequest forRun(CiKeysService.Context identity,long run,Connection c) {
        var q=QCiRequest.table;var u=QUsageRun.table;var r=QAuditRun.auditRun;
        return tx.selectQuery(c).select(q).from(q).join(u).on(u.ciIntentId.eq(q.publicId)).join(r).on(r.id.eq(u.id))
            .where(q.ownerUserId.eq(identity.owner()),q.integrationId.eq(identity.integrationId()),u.ciIntegrationId.eq(identity.integrationId()),
                u.userId.eq(identity.owner()),r.ownerUserId.eq(identity.owner()),r.id.eq(run),r.ciNavigationOrigins.isNotNull()).fetchOne();
    }
    private static String iso(Timestamp value){return value==null?null:value.toInstant().toString();}
}
