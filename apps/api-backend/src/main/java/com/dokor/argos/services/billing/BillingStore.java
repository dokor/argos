package com.dokor.argos.services.billing;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.AccountError;
import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.function.*;
import static com.dokor.argos.services.billing.StripeObjects.require;

/** Account -> CI grant -> billing lock order, shared by admission and every projection writer. */
@Singleton
public final class BillingStore {
    private final AccountDao dao;private final BillingSettings settings;private final Clock clock;
    private record Locked(String state,String offer,String source,Instant grantUntil,BillingAccount row){}
    @Inject public BillingStore(AccountDao dao,BillingSettings settings,Clock clock){this.dao=dao;this.settings=settings;this.clock=clock;}
    public BillingAccount read(long owner,Connection c){var t=QBillingAccount.table;
        return dao.transactions.selectQuery(c).select(t).from(t).where(t.id.eq(owner)).fetchOne();}
    private <T>T locked(long owner,BiFunction<Locked,Connection,T> work){
        try{return dao.transaction(c->{
            try{
                String state,offer,source=null;Instant until=null;
                try(var s=c.prepareStatement("SELECT state,offer FROM ARG_ACCOUNT_USER WHERE id=? FOR UPDATE")){
                    s.setLong(1,owner);try(var r=s.executeQuery()){if(!r.next())throw AccountError.missing();state=r.getString(1);offer=r.getString(2);}}
                try(var s=c.prepareStatement("SELECT grant_source,valid_until FROM ARG_ACCOUNT_CI_ENTITLEMENT WHERE id=? FOR UPDATE")){
                    s.setLong(1,owner);try(var r=s.executeQuery()){if(r.next()){source=r.getString(1);until=r.getTimestamp(2).toInstant();}}}
                return work.apply(new Locked(state,offer,source,until,read(owner,c)),c);
            }catch(SQLException ignored){throw BillingError.unavailable();}
        });}catch(BillingError|AccountError known){throw known;}catch(Exception ignored){throw BillingError.unavailable();}
    }
    private void save(BillingAccount a,Connection c){dao.save(a,QBillingAccount.table,c);}
    private void sameEnvironment(BillingAccount a){require(a.getStripeAccount().equals(settings.id("account-id"))&&a.getLiveMode()==settings.live());}
    public BillingAccount claim(long owner,boolean create){
        return claim(owner,create,false);
    }
    /** Access to invoices/cancellation must survive an administrative entitlement change. */
    public BillingAccount claimPortal(long owner){return claim(owner,false,true);}
    private BillingAccount claim(long owner,boolean create,boolean portalOnly){
        return locked(owner,(scope,c)->{
            if(!scope.state.equals("ACTIVE"))throw AccountError.unauthorized();
            var a=scope.row;
            if(a==null){
                if(!create)throw new BillingError("billing_sync_pending");
                if(scope.offer.equals("PREMIUM")||scope.source!=null)throw new BillingError("billing_managed_elsewhere");
                a=new BillingAccount();a.setId(owner);a.setBindingId(UUID.randomUUID().toString());a.setStripeAccount(settings.id("account-id"));a.setLiveMode(settings.live());
                a.setPhase("NONE");a.setStatus("NONE");a.setNextSyncAt(clock.instant());a.setSyncGeneration(0L);a.setAttempts(0);a.setManagedOffer(false);
                var t=QBillingAccount.table;dao.transactions.insert(t,c).populate(a).execute();
            }
            sameEnvironment(a);
            if(!portalOnly&&(scope.source!=null&&!scope.source.equals("STRIPE")||a.getManagedOffer()&&!scope.offer.equals("PREMIUM")
                ||!a.getManagedOffer()&&scope.offer.equals("PREMIUM")))throw new BillingError("billing_managed_elsewhere");
            if(a.getLeaseUntil()!=null&&a.getLeaseUntil().isAfter(clock.instant()))throw new BillingError("billing_sync_pending");
            a.setLeaseToken(UUID.randomUUID().toString());a.setLeaseUntil(clock.instant().plusSeconds(120));save(a,c);return a;
        });
    }
    private void owns(Locked scope,BillingAccount claimed){
        var a=scope.row;
        if(!scope.state.equals("ACTIVE")||a==null||!Objects.equals(a.getLeaseToken(),claimed.getLeaseToken())
            ||a.getLeaseUntil()==null||!a.getLeaseUntil().isAfter(clock.instant())||!a.getSyncGeneration().equals(claimed.getSyncGeneration()))
            throw new BillingError("billing_sync_pending");
        sameEnvironment(a);
    }
    public BillingAccount update(BillingAccount claimed,Consumer<BillingAccount> edit){
        return locked(claimed.getId(),(scope,c)->{owns(scope,claimed);edit.accept(scope.row);save(scope.row,c);return scope.row;});
    }
    /** Releases only its own lease, including when a later webhook changed the generation. */
    public void release(BillingAccount claimed){
        locked(claimed.getId(),(scope,c)->{var a=scope.row;if(a!=null&&Objects.equals(a.getLeaseToken(),claimed.getLeaseToken())){
            a.setLeaseToken(null);a.setLeaseUntil(null);save(a,c);}return null;});
    }
    public void failure(BillingAccount claimed,String code){
        locked(claimed.getId(),(scope,c)->{var a=scope.row;if(a==null||!Objects.equals(a.getLeaseToken(),claimed.getLeaseToken()))return null;
            a.setLastError(BillingError.CODES.contains(code)?code:"billing_unavailable");
            int attempts=Math.min(a.getAttempts()+1,7);a.setAttempts(attempts);
            long seconds=attempts>=6?3600:Math.min(900,60L<<(attempts-1));
            // A webhook received after this claim must not be postponed by an older worker.
            if(a.getSyncGeneration().equals(claimed.getSyncGeneration()))a.setNextSyncAt(clock.instant().plusSeconds(seconds));
            a.setLeaseToken(null);a.setLeaseUntil(null);save(a,c);return null;});
    }
    public void project(BillingAccount claimed,StripeBillingReader.Projection projection){
        locked(claimed.getId(),(scope,c)->{
            owns(scope,claimed);var a=scope.row;
            if(scope.source!=null&&!scope.source.equals("STRIPE"))throw new BillingError("billing_managed_elsewhere");
            if(a.getManagedOffer()&&!scope.offer.equals("PREMIUM"))throw new BillingError("billing_managed_elsewhere");
            try{
                boolean paid=projection.paid()&&projection.periodEnd()!=null&&projection.periodEnd().isAfter(clock.instant());
                if(paid){
                    if(!a.getManagedOffer()){
                        if(!Set.of("FREE","STANDARD").contains(scope.offer))throw new BillingError("billing_managed_elsewhere");
                        a.setPriorOffer(scope.offer);
                    }
                    Instant until=projection.periodEnd().isBefore(clock.instant().plusSeconds(900))?projection.periodEnd():clock.instant().plusSeconds(900);
                    try(var s=c.prepareStatement("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at,grant_source) VALUES(?,1,?,?,'STRIPE') ON DUPLICATE KEY UPDATE ci_access=1,valid_until=VALUES(valid_until),updated_at=VALUES(updated_at)")){
                        s.setLong(1,a.getId());s.setTimestamp(2,Timestamp.from(until));s.setTimestamp(3,Timestamp.from(clock.instant()));s.executeUpdate();}
                    try(var s=c.prepareStatement("UPDATE ARG_ACCOUNT_USER SET offer='PREMIUM' WHERE id=?")){s.setLong(1,a.getId());s.executeUpdate();}
                    a.setManagedOffer(true);
                }else revoke(scope,c);
                a.setStatus(projection.status());a.setBillingInterval(projection.interval());a.setPeriodEnd(projection.periodEnd());
                a.setSubscriptionId(projection.subscriptionId());a.setChargeId(projection.chargeId());a.setLastSyncedAt(clock.instant());
                a.setNextSyncAt(clock.instant().plusSeconds(300));a.setAttempts(0);a.setLastError(null);save(a,c);return null;
            }catch(SQLException ignored){throw BillingError.unavailable();}
        });
    }
    private void revoke(Locked scope,Connection c)throws SQLException{
        var a=scope.row;if(!"STRIPE".equals(scope.source))return;
        try(var s=c.prepareStatement("UPDATE ARG_ACCOUNT_CI_ENTITLEMENT SET ci_access=0,valid_until=?,updated_at=? WHERE id=? AND grant_source='STRIPE'")){
            s.setTimestamp(1,Timestamp.from(clock.instant()));s.setTimestamp(2,Timestamp.from(clock.instant()));s.setLong(3,a.getId());s.executeUpdate();}
        if(a.getManagedOffer()&&scope.offer.equals("PREMIUM")&&a.getPriorOffer()!=null){
            try(var s=c.prepareStatement("UPDATE ARG_ACCOUNT_USER SET offer=? WHERE id=?")){s.setString(1,a.getPriorOffer());s.setLong(2,a.getId());s.executeUpdate();}}
        a.setManagedOffer(false);
    }
    /** Time-based expiry works even when provider reconciliation is unavailable. Never deletes runs, reports or keys. */
    public void expire(){
        var t=QBillingAccount.table;var now=clock.instant();
        var ids=dao.transactions.selectQuery().select(t.id).from(t).where(t.managedOffer.isTrue(),
            t.lastSyncedAt.loe(now.minusSeconds(900)).or(t.periodEnd.loe(now))).orderBy(t.id.asc()).limit(100).fetch();
        for(var id:ids)locked(id,(scope,c)->{var a=scope.row;
            if(a!=null&&a.getManagedOffer()&&((a.getLastSyncedAt()!=null&&!a.getLastSyncedAt().plusSeconds(900).isAfter(now))
                ||(a.getPeriodEnd()!=null&&!a.getPeriodEnd().isAfter(now)))){
                try{revoke(scope,c);a.setLastError("billing_sync_pending");save(a,c);}catch(SQLException e){throw BillingError.unavailable();}}
            return null;});
    }
    public List<Long> due(){
        var t=QBillingAccount.table;var now=clock.instant();return dao.transactions.selectQuery().select(t.id).from(t)
            .where(t.nextSyncAt.loe(now),t.leaseUntil.isNull().or(t.leaseUntil.loe(now))).orderBy(t.nextSyncAt.asc(),t.id.asc()).limit(settings.batchSize()).fetch();
    }
    public Long owner(String customer,String charge){
        var t=QBillingAccount.table;
        if(customer==null&&charge==null)return null;
        return dao.transactions.selectQuery().select(t.id).from(t).where(customer!=null?t.customerId.eq(customer):t.chargeId.eq(charge),
            t.stripeAccount.eq(settings.id("account-id")),t.liveMode.eq(settings.live())).fetchOne();
    }
    /** Event receipt and generation bump commit together, before acknowledging Stripe. */
    public void event(long owner,String eventId,String type,byte[] digest){
        locked(owner,(scope,c)->{
            var a=scope.row;if(a==null)return null;sameEnvironment(a);
            try{
                try(var s=c.prepareStatement("SELECT body_hash FROM ARG_BILLING_EVENT WHERE stripe_account=? AND live_mode=? AND event_id=?")){
                    s.setString(1,settings.id("account-id"));s.setBoolean(2,settings.live());s.setString(3,eventId);try(var r=s.executeQuery()){
                        if(r.next()){if(!java.security.MessageDigest.isEqual(digest,r.getBytes(1)))throw new BillingError("billing_webhook_invalid");return null;}}}
                try(var s=c.prepareStatement("INSERT INTO ARG_BILLING_EVENT(event_id,stripe_account,live_mode,body_hash,event_type,received_at,owner_id) VALUES(?,?,?,?,?,?,?)")){
                    s.setString(1,eventId);s.setString(2,settings.id("account-id"));s.setBoolean(3,settings.live());s.setBytes(4,digest);s.setString(5,type);
                    s.setTimestamp(6,Timestamp.from(clock.instant()));s.setLong(7,owner);s.executeUpdate();}
                a.setSyncGeneration(Math.addExact(a.getSyncGeneration(),1));a.setNextSyncAt(clock.instant());save(a,c);return null;
            }catch(SQLException ignored){throw BillingError.unavailable();}
        });
    }
    public void purgeEvents(){dao.transaction(c->{try(var s=c.prepareStatement("DELETE FROM ARG_BILLING_EVENT WHERE received_at < ? LIMIT 500")){
        s.setTimestamp(1,Timestamp.from(clock.instant().minus(Duration.ofDays(90))));s.executeUpdate();return null;
    }catch(SQLException ignored){throw BillingError.unavailable();}});}
}
