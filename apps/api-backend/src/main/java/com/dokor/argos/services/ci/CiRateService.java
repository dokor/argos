package com.dokor.argos.services.ci;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.*;
import jakarta.ws.rs.WebApplicationException;
import java.sql.*;
import java.time.Clock;
import java.util.*;

/** Technical safety ceilings, not measured production capacity or monthly entitlement. */
@Singleton
public class CiRateService {
    private record Budget(String key,int maximum,int seconds) {}
    private final AccountDao dao; private final TokenService tokens; private final Clock clock;
    @Inject public CiRateService(AccountDao dao,TokenService tokens,Clock clock) {this.dao=dao;this.tokens=tokens;this.clock=clock;}

    public void ingress(String nativePeer) {
        committed(List.of(new Budget("ingress:global",6000,60),new Budget("ingress:peer:"+nativePeer,1200,60)));
    }
    /** Separate committed transaction: malformed bodies, failed admissions and reads all spend traffic. */
    public void traffic(CiKeysService.Context identity,boolean write) {
        String kind=write?"write":"read";
        committed(List.of(new Budget(kind+":global",write?120:1200,60),
            new Budget(kind+":owner:"+identity.owner(),write?10:120,60),
            new Budget(kind+":integration:"+identity.integrationId(),write?6:90,60)));
    }
    private void committed(List<Budget> budgets) {
        CiAccountOperations.boundary(()->{
            dao.transaction(c->{try(var s=c.prepareStatement("DELETE FROM ARG_ACCOUNT_RATE WHERE expires_at<? LIMIT 1000")) {
                s.setTimestamp(1,Timestamp.from(clock.instant()));s.executeUpdate();return null;
            }catch(SQLException failed){throw new IllegalStateException("CI traffic storage unavailable");}});
            long retry=dao.transaction(c->consume(c,budgets,1));
            if(retry>0) throw limited(CiErrorCode.RATE_LIMITED,retry);
            return null;
        });
    }
    /** Persist only with a successful admission. Failed executions never refund this hourly budget. */
    public void execution(CiKeysService.Context identity,String canonicalOrigin,int samples,Connection c) {
        long retry=consume(c,List.of(new Budget("execution:global",60,3600),
            new Budget("execution:owner:"+identity.owner(),12,3600),
            new Budget("execution:integration:"+identity.integrationId(),6,3600),
            new Budget("execution:target:"+canonicalOrigin,12,3600)),samples);
        if(retry>0) throw limited(CiErrorCode.RATE_LIMITED,retry);
    }
    private long consume(Connection c,List<Budget> budgets,int weight) {
        long retry=0;
        // Stable lock order even when requests share only a subset of buckets.
        for(var budget:budgets.stream().sorted(Comparator.comparing(Budget::key)).toList()) {
            long window=clock.instant().getEpochSecond()/budget.seconds();
            byte[] hash=tokens.sha256("ci-budget:"+budget.key()+":"+window);
            var end=java.time.Instant.ofEpochSecond((window+1)*budget.seconds());
            try {
                try(var s=c.prepareStatement("INSERT INTO ARG_ACCOUNT_RATE(bucket_hash,attempts,expires_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE attempts=LEAST(attempts+VALUES(attempts),1000000)")) {
                    s.setBytes(1,hash);s.setInt(2,weight);s.setTimestamp(3,Timestamp.from(end));s.executeUpdate();
                }
                try(var s=c.prepareStatement("SELECT attempts FROM ARG_ACCOUNT_RATE WHERE bucket_hash=? FOR UPDATE")) {
                    s.setBytes(1,hash);try(var r=s.executeQuery()) {
                        if(!r.next()) throw new IllegalStateException("CI traffic bucket missing");
                        if(r.getInt(1)>budget.maximum()) retry=Math.max(retry,Math.max(1,end.getEpochSecond()-clock.instant().getEpochSecond()));
                    }
                }
            }catch(SQLException failed){throw new IllegalStateException("CI traffic storage unavailable");}
        }
        return retry;
    }
    public static WebApplicationException limited(CiErrorCode code,long delay) {
        return new WebApplicationException(CiErrors.response(code,Math.min(CiErrors.MAX_RETRY_AFTER_SECONDS,Math.max(1,delay))));
    }
}
