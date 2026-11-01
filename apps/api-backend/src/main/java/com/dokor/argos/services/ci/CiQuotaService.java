package com.dokor.argos.services.ci;

import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.account.UsagePolicy;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.*;
import jakarta.ws.rs.WebApplicationException;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Caller authenticates key/scope/proofs. Account -> key/target -> queue -> usage, on one connection. */
@Singleton
public class CiQuotaService {
    public record Snapshot(String period,String timezone,String startsAt,String resetsAt,long used,long reserved,long limit,long available) {}
    private final AuditRunDao runs; private final CiEntitlementService entitlement; private final CiPolicy policy;
    private final UsagePolicy months; private final CiRateService rates; private final TokenService tokens; private final Clock clock;
    @Inject public CiQuotaService(AuditRunDao runs,CiEntitlementService entitlement,CiPolicy policy,UsagePolicy months,
            CiRateService rates,TokenService tokens,Clock clock) {
        this.runs=runs;this.entitlement=entitlement;this.policy=policy;this.months=months;this.rates=rates;this.tokens=tokens;this.clock=clock;
    }
    public Snapshot snapshot(CiKeysService.Context identity,Connection c) {
        runs.usage().lock(identity.owner(),c);
        return read(identity,c);
    }
    private Snapshot read(CiKeysService.Context identity,Connection c) {
        var period=months.period(clock.instant());long used=0,reserved=0;
        try(var s=c.prepareStatement("SELECT state,COUNT(*) FROM ARG_USAGE_RUN WHERE user_id=? AND ci_integration_id=? AND (state='RESERVED' OR (state='COUNTED' AND period=?)) GROUP BY state FOR UPDATE")) {
            s.setLong(1,identity.owner());s.setLong(2,identity.integrationId());s.setString(3,period.toString());
            try(var r=s.executeQuery()){while(r.next()){if("COUNTED".equals(r.getString(1)))used=r.getLong(2);else reserved=r.getLong(2);}}
        }catch(SQLException failed){throw new IllegalStateException("CI usage unavailable");}
        long limit=policy.limits().orElseThrow().monthlyAnalysesPerKey();
        return new Snapshot(period.toString(),months.zone().getId(),months.start(period).toString(),months.reset(period).toString(),used,reserved,limit,Math.max(0,limit-used-reserved));
    }
    /** Precheck all samples BEFORE any run is inserted; a refused pair creates no child. */
    public void admit(CiKeysService.Context identity,String origin,int samples,Connection c) {
        if(samples<1 || samples>2) throw CiAccountOperations.fail(CiErrorCode.CONFIG_INVALID);
        entitlement.requireNewAccess(identity.owner(),c);
        runs.lockAdmission(c);
        try {entitlement.admitMany(identity.owner(),samples,c);}
        catch(WebApplicationException rejected) {
            if(rejected.getResponse().getStatus()!=429) throw rejected;
            throw CiRateService.limited(CiErrorCode.QUOTA_EXCEEDED,Duration.between(clock.instant(),months.reset(months.period(clock.instant()))).getSeconds());
        }
        var view=read(identity,c);
        if(view.available()<samples) throw CiRateService.limited(CiErrorCode.QUOTA_EXCEEDED,Duration.between(clock.instant(),Instant.parse(view.resetsAt())).getSeconds());
        // One outstanding intention per account (one or two sequential samples); leave room for other users.
        if(count(c,"SELECT COUNT(*) FROM ARG_USAGE_RUN WHERE user_id=? AND ci_integration_id IS NOT NULL AND state='RESERVED' FOR UPDATE",identity.owner())>0
            || count(c,"SELECT COUNT(*) FROM ARG_USAGE_RUN WHERE ci_integration_id IS NOT NULL AND state='RESERVED' FOR UPDATE")+samples>25
            || count(c,"SELECT COUNT(*) FROM ARG_USAGE_RUN WHERE ci_target_hash=? AND state='RESERVED' FOR UPDATE",tokens.sha256(origin))+samples>4
            || count(c,"SELECT pending FROM ARG_AUDIT_ADMISSION WHERE id=1 FOR UPDATE")+samples>100)
            throw CiRateService.limited(CiErrorCode.CAPACITY_UNAVAILABLE,60);
        rates.execution(identity,origin,samples,c);
    }
    /** The run and its authoritative reservation already exist in this same transaction. */
    public void attribute(AuditRun run,CiKeysService.Context identity,String origin,String intent,int sample,Connection c) {
        if(run.getCiNavigationOrigins()==null || !Objects.equals(run.getOwnerUserId(),identity.owner()) || !UUID.fromString(intent).toString().equals(intent) || sample<1 || sample>2)
            throw new IllegalArgumentException("Invalid CI attribution");
        try(var s=c.prepareStatement("UPDATE ARG_USAGE_RUN SET ci_integration_id=?,ci_target_hash=?,ci_intent_id=?,ci_sample=? WHERE id=? AND user_id=? AND state='RESERVED' AND ci_integration_id IS NULL")) {
            s.setLong(1,identity.integrationId());s.setBytes(2,tokens.sha256(origin));s.setString(3,intent);s.setInt(4,sample);
            s.setLong(5,run.getId());s.setLong(6,identity.owner());if(s.executeUpdate()!=1)throw new IllegalStateException("CI reservation missing");
        }catch(SQLException failed){throw new IllegalStateException("CI attribution unavailable");}
    }
    private long count(Connection c,String sql,Object... values) {
        try(var s=c.prepareStatement(sql)){for(int n=0;n<values.length;n++)s.setObject(n+1,values[n]);try(var r=s.executeQuery()){if(!r.next())throw new IllegalStateException("CI capacity missing");return r.getLong(1);}}
        catch(SQLException failed){throw new IllegalStateException("CI capacity unavailable");}
    }
}
