package com.dokor.argos.services.account;

import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

/** A private projection of the single per-run ledger, not a second credit counter. */
@Singleton
public final class UsageHistoryService {
    private final AccountSessionService sessions;
    private final UsagePolicy policy;
    private final Clock clock;
    @Inject public UsageHistoryService(AccountSessionService sessions,UsagePolicy policy,Clock clock) {
        this.sessions=sessions;this.policy=policy;this.clock=clock;
    }
    public UsageEvents events(String auth,String requestedPeriod,int limit,long offset) {
        if(limit<1 || limit>100 || offset<0 || offset>9_007_199_254_740_991L) throw new AccountError(400,"payload_invalid");
        String current=policy.period(clock.instant()).toString();
        String period=requestedPeriod==null ? current:requestedPeriod;
        try {if(!period.matches("[0-9]{4}-(0[1-9]|1[0-2])")) throw new IllegalArgumentException();YearMonth.parse(period);}
        catch(RuntimeException e){throw new AccountError(400,"period_invalid");}
        return sessions.with(auth,null,true,false,(context,c)->read(context.user().getId(),period,current,limit,offset,c));
    }
    private UsageEvents read(long owner,String period,String current,int limit,long offset,Connection c) {
        String scope="u.user_id=? AND (u.period=?"+(period.equals(current) ? " OR u.state='RESERVED'":"")+")";
        try {
            long total;
            try(var s=c.prepareStatement("SELECT COUNT(*) FROM ARG_USAGE_RUN u WHERE "+scope)) {
                s.setLong(1,owner);s.setString(2,period);try(var rows=s.executeQuery()){rows.next();total=rows.getLong(1);}
            }
            var items=new ArrayList<UsageEvent>();
            try(var s=c.prepareStatement("SELECT u.id,u.state,u.period,u.created_at,u.counted_at,u.released_at,p.batch_id,a.normalized_url "
                    +"FROM ARG_USAGE_RUN u JOIN ARG_AUDIT_RUN r ON r.id=u.id AND r.owner_user_id=u.user_id "
                    +"JOIN ARG_AUDIT a ON a.id=r.audit_id LEFT JOIN ARG_DOMAIN_BATCH_PAGE p ON p.run_id=u.id AND p.owner_user_id=u.user_id "
                    +"WHERE "+scope+" ORDER BY COALESCE(u.counted_at,u.released_at,u.created_at) DESC,u.id DESC LIMIT ? OFFSET ?")) {
                s.setLong(1,owner);s.setString(2,period);s.setInt(3,limit);s.setLong(4,offset);
                try(var rows=s.executeQuery()){while(rows.next())items.add(new UsageEvent(Long.toString(rows.getLong(1)),
                    rows.getObject(7)==null ? null:Long.toString(rows.getLong(7)),UsageState.valueOf(rows.getString(2)),rows.getString(3),
                    date(rows.getTimestamp(4)),date(rows.getTimestamp(5)),date(rows.getTimestamp(6)),rows.getString(8)));}
            }
            return new UsageEvents(items,total,(long)limit,offset,clock.instant().toString(),period);
        }catch(SQLException e){throw new IllegalStateException("Usage history unavailable",e);}
    }
    private static String date(Timestamp value){return value==null ? null:value.toInstant().toString();}
}
