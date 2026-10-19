package com.dokor.argos.services.ci;

import com.dokor.argos.services.account.UsagePolicy;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Owner-only browser snapshot. Never authenticates or admits a machine operation. */
@Singleton
public class CiAccountStatusService {
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Limits(int monthlyAnalysesPerKey,int activeKeys,Integer verifiedTargets,int concurrentRuns,int keyLifetimeYears) {}
    public record Integration(String id,int slot,long used,long reserved) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Snapshot(boolean enabled,boolean eligible,String offer,String validUntil,Limits limits,
                           String period,String timezone,String startsAt,String resetsAt,List<Integration> integrations) {}
    private final CiAccountOperations accounts; private final CiPolicy policy; private final UsagePolicy months; private final Clock clock;
    @Inject public CiAccountStatusService(CiAccountOperations accounts,CiPolicy policy,UsagePolicy months,Clock clock) {
        this.accounts=accounts;this.policy=policy;this.months=months;this.clock=clock;
    }
    public Snapshot read(String auth) {
        return accounts.read(auth,(ctx,c)->{
            var now=clock.instant();var period=months.period(now);var configured=policy.limits().orElse(null);
            Instant until=null;boolean access=false;
            try(var s=c.prepareStatement("SELECT ci_access,valid_until FROM ARG_ACCOUNT_CI_ENTITLEMENT WHERE id=?")) {
                s.setLong(1,ctx.user().getId());
                try(var r=s.executeQuery()){if(r.next()){access=r.getBoolean(1);var value=r.getTimestamp(2);until=value==null?null:value.toInstant();}}
            }catch(SQLException failed){throw new IllegalStateException("CI access unavailable");}
            var integrations=new ArrayList<Integration>();
            // Aggregate only this owner's ledger. Reserved work still consumes capacity across month boundaries.
            try(var s=c.prepareStatement("SELECT i.public_id,i.slot,COALESCE(SUM(CASE WHEN u.state='COUNTED' THEN 1 ELSE 0 END),0),COALESCE(SUM(CASE WHEN u.state='RESERVED' THEN 1 ELSE 0 END),0) FROM ARG_CI_INTEGRATION i LEFT JOIN ARG_USAGE_RUN u ON u.ci_integration_id=i.id AND u.user_id=i.owner_user_id AND (u.state='RESERVED' OR (u.state='COUNTED' AND u.period=?)) WHERE i.owner_user_id=? GROUP BY i.id,i.public_id,i.slot ORDER BY i.slot LIMIT 101")) {
                s.setString(1,period.toString());s.setLong(2,ctx.user().getId());
                try(var r=s.executeQuery()){while(r.next()){if(integrations.size()==100)throw new IllegalStateException("CI integration limit unavailable");integrations.add(new Integration(r.getString(1),r.getInt(2),r.getLong(3),r.getLong(4)));}}
            }catch(SQLException failed){throw new IllegalStateException("CI usage unavailable");}
            var limits=configured==null?null:new Limits(configured.monthlyAnalysesPerKey(),configured.activeKeys(),
                configured.verifiedTargets().isPresent()?configured.verifiedTargets().getAsInt():null,configured.concurrentRuns(),configured.keyLifetimeYears());
            boolean enabled=configured!=null;
            boolean eligible=enabled&&"ACTIVE".equals(ctx.user().getState())&&"PREMIUM".equals(ctx.user().getOffer())&&access&&until!=null&&until.isAfter(now);
            return new Snapshot(enabled,eligible,ctx.user().getOffer(),until==null?null:until.toString(),limits,period.toString(),months.zone().getId(),
                months.start(period).toString(),months.reset(period).toString(),List.copyOf(integrations));
        });
    }
}
