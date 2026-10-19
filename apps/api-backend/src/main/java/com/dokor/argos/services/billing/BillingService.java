package com.dokor.argos.services.billing;

import com.dokor.argos.db.generated.BillingAccount;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.CiPolicy;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import static com.dokor.argos.services.billing.StripeObjects.*;

@Singleton
public final class BillingService {
    @JsonInclude(JsonInclude.Include.ALWAYS) public record Plan(String interval,String currency,Long amountHtCents){}
    @JsonInclude(JsonInclude.Include.ALWAYS) public record Snapshot(int schemaVersion,boolean enabled,boolean paymentsEnabled,
        boolean ciEnabled,String offer,String status,String phase,String sync,String interval,String periodEnd,String lastSyncedAt,
        String diagnostic,boolean canCheckout,boolean portalAvailable,List<Plan> plans){}
    public record Destination(String url){}
    private final BillingSettings settings;private final BillingStore store;private final StripeGateway gateway;
    private final AccountSessionService sessions;private final AccountSettings accounts;private final AccountRateLimiter rate;
    private final Clock clock;private final CiPolicy ci;
    @Inject public BillingService(BillingSettings settings,BillingStore store,StripeGateway gateway,AccountSessionService sessions,
        AccountSettings accounts,AccountRateLimiter rate,Clock clock,CiPolicy ci){
        this.settings=settings;this.store=store;this.gateway=gateway;this.sessions=sessions;this.accounts=accounts;this.rate=rate;this.clock=clock;this.ci=ci;
    }
    public Snapshot status(String auth){try{return sessions.with(auth,null,true,false,(ctx,c)->{
        var a=store.read(ctx.user().getId(),c);boolean same=a==null||a.getStripeAccount().equals(settings.id("account-id"))&&a.getLiveMode()==settings.live();
        boolean owned=!(ctx.user().getOffer().equals("PREMIUM")&&(a==null||!a.getManagedOffer()));
        String phase=a==null?"NONE":a.getPhase(),state=a==null?"NONE":a.getStatus();
        String sync=a==null?"NEVER":a.getLastError()!=null?"DEFERRED":a.getLastSyncedAt()==null?"PENDING":
            a.getLastSyncedAt().plusSeconds(900).isAfter(clock.instant())?"CURRENT":"DEFERRED";
        boolean checkout=settings.payments()&&same&&owned&&(!phase.equals("COMPLETE")||state.equals("ENDED"))&&!Set.of("ACTIVE","CANCEL_AT_PERIOD_END","PAYMENT_REQUIRED","REFUNDED","DISPUTED").contains(state);
        return new Snapshot(1,settings.enabled(),settings.payments(),ci.limits().isPresent(),ctx.user().getOffer(),state,phase,sync,
            a==null?null:Set.of("CHECKOUT_PENDING","OPEN").contains(a.getPhase())?a.getCheckoutInterval():a.getBillingInterval(),a==null||a.getPeriodEnd()==null?null:a.getPeriodEnd().toString(),
            a==null||a.getLastSyncedAt()==null?null:a.getLastSyncedAt().toString(),!same?"billing_configuration":!owned?"billing_managed_elsewhere":a==null?null:a.getLastError(),
            checkout,settings.enabled()&&same&&a!=null&&a.getCustomerId()!=null,
            List.of(new Plan("MONTH","EUR",settings.pricesApproved()?settings.amount("MONTH"):null),
                new Plan("YEAR","EUR",settings.pricesApproved()?settings.amount("YEAR"):null)));
    });}catch(BillingError|AccountError known){throw known;}catch(Exception ignored){throw BillingError.unavailable();}}
    private long actor(String auth,String csrf,String remote){
        if(!AccountCsrf.valid(csrf))throw AccountError.forbidden("csrf_invalid");
        long owner=sessions.with(auth,csrf,true,true,(ctx,c)->{sessions.recent(ctx);return ctx.user().getId();});
        rate.check("billing",Long.toString(owner),remote);return owner;
    }
    public Destination checkout(String auth,String csrf,String interval,String lang,String remote){
        long owner=actor(auth,csrf,remote);settings.requirePayments();
        if(!Set.of("MONTH","YEAR").contains(interval)||!Set.of("fr","en").contains(lang))throw new BillingError("billing_request_invalid");
        var claimed=store.claim(owner,true);
        try{
            var reader=new StripeBillingReader(gateway,settings,clock.instant());reader.environment();reader.prices();
            var a=claimed;
            if(a.getCustomerId()==null&&a.getCustomerAttemptedAt()!=null)a=recoverCustomer(a,reader);
            if(a.getCustomerId()==null){
                if(a.getCustomerAttemptedAt()!=null&&!a.getCustomerAttemptedAt().plus(Duration.ofHours(23)).isAfter(clock.instant()))
                    throw new BillingError("billing_sync_pending");
                a=store.update(a,row->{if(row.getCustomerAttemptedAt()==null)row.setCustomerAttemptedAt(clock.instant());row.setPhase("CUSTOMER_PENDING");});
                var customer=reader.post("/v1/customers",Map.of("metadata[argos_billing_id]",a.getBindingId()),"argos-customer-"+a.getBindingId());
                type(customer,"customer");reader.mode(customer);require(text(customer.path("metadata"),"argos_billing_id").equals(a.getBindingId()));
                String id=id(customer,"id","cus");a=store.update(a,row->{row.setCustomerId(id);row.setPhase("NONE");});
            }
            reader.customer(a);
            var subscriptions=reader.list("/v1/subscriptions",Map.of("customer",a.getCustomerId(),"status","all"));
            if(subscriptions.stream().anyMatch(n->!Set.of("canceled","incomplete_expired").contains(text(n,"status"))))
                throw new BillingError("billing_existing_subscription");
            var existing=reader.list("/v1/checkout/sessions",Map.of("customer",a.getCustomerId()));
            if(a.getPhase().equals("EXPIRED")||(a.getPhase().equals("COMPLETE")&&a.getStatus().equals("ENDED"))){
                if(existing.stream().anyMatch(n->text(n,"status").equals("open")))throw new BillingError("billing_sync_pending");
                a=store.update(a,row->{row.setCheckoutKey(null);row.setCheckoutId(null);row.setCheckoutInterval(null);row.setCheckoutCreatedAt(null);
                    row.setCheckoutAttemptedAt(null);row.setCheckoutExpiresAt(null);row.setPhase("NONE");});
            }
            if(a.getCheckoutKey()==null){
                if(existing.stream().anyMatch(n->text(n,"status").equals("open")))throw new BillingError("billing_existing_subscription");
                String origin=returnOrigin();
                a=store.update(a,row->{row.setCheckoutKey(UUID.randomUUID().toString());row.setCheckoutInterval(interval);
                    row.setCheckoutLang(lang);row.setCheckoutPriceId(settings.price(interval));row.setCheckoutOrigin(origin.replaceAll("/+$",""));
                    row.setCheckoutCreatedAt(clock.instant());row.setCheckoutExpiresAt(clock.instant().plus(Duration.ofHours(2)));row.setPhase("CHECKOUT_PENDING");});
            }
            if(!a.getCheckoutInterval().equals(interval))throw new BillingError("billing_interval_locked");
            require(a.getCheckoutPriceId().equals(settings.price(a.getCheckoutInterval())));
            if(a.getCheckoutId()==null){
                var pending=a;
                var found=existing.stream().filter(n->pending.getCheckoutKey().equals(n.path("client_reference_id").asText())).toList();
                require(found.size()<=1);
                if(!found.isEmpty()){validateSession(found.getFirst(),a,reader,false);String id=id(found.getFirst(),"id","cs");
                    a=store.update(a,row->row.setCheckoutId(id));}
                else{
                    if(!a.getCheckoutExpiresAt().plusSeconds(300).isAfter(clock.instant())){
                        store.update(a,row->row.setPhase("EXPIRED"));throw new BillingError("billing_sync_pending");}
                    if(!a.getCheckoutExpiresAt().minusSeconds(1800).isAfter(clock.instant()))
                        throw new BillingError("billing_sync_pending");
                    a=store.update(a,row->{if(row.getCheckoutAttemptedAt()==null)row.setCheckoutAttemptedAt(clock.instant());});
                    var data=new HashMap<String,String>();
                    data.put("mode","subscription");data.put("customer",a.getCustomerId());data.put("client_reference_id",a.getCheckoutKey());
                    data.put("line_items[0][price]",a.getCheckoutPriceId());data.put("line_items[0][quantity]","1");
                    data.put("payment_method_types[0]","card");data.put("automatic_tax[enabled]","true");
                    data.put("billing_address_collection","required");data.put("customer_update[address]","auto");
                    data.put("tax_id_collection[enabled]","true");data.put("allow_promotion_codes","false");
                    data.put("expires_at",Long.toString(a.getCheckoutExpiresAt().getEpochSecond()));
                    data.put("metadata[argos_billing_id]",a.getBindingId());data.put("metadata[argos_price_id]",a.getCheckoutPriceId());
                    data.put("subscription_data[metadata][argos_billing_id]",a.getBindingId());data.put("locale",a.getCheckoutLang());
                    String page=a.getCheckoutOrigin()+(a.getCheckoutLang().equals("en")?"/en":"")+"/account/billing";
                    data.put("success_url",page+"?payment=return");data.put("cancel_url",page+"?payment=cancel");
                    var created=reader.post("/v1/checkout/sessions",data,"argos-checkout-"+a.getCheckoutKey());
                    validateSession(created,a,reader,false);String id=id(created,"id","cs");a=store.update(a,row->row.setCheckoutId(id));
                }
            }
            var session=reader.get("/v1/checkout/sessions/"+a.getCheckoutId(),Map.of("expand[0]","line_items"));
            validateSession(session,a,reader,true);String state=text(session,"status");
            if(!state.equals("open")){
                store.update(a,row->{row.setPhase(state.equals("expired")?"EXPIRED":"COMPLETE");row.setNextSyncAt(clock.instant());});
                throw new BillingError("billing_sync_pending");
            }
            String url=destination(text(session,"url"),false);store.update(a,row->{row.setPhase("OPEN");row.setLastError(null);});
            return new Destination(url);
        }catch(BillingError failure){store.failure(claimed,failure.code());throw failure;}
        catch(Exception ignored){store.failure(claimed,"billing_unavailable");throw BillingError.unavailable();}
        finally{store.release(claimed);}
    }
    private void validateSession(JsonNode n,BillingAccount a,StripeBillingReader reader,boolean lines){
        type(n,"checkout.session");reader.mode(n);id(n,"id","cs");
        require(text(n,"customer").equals(a.getCustomerId())&&text(n,"mode").equals("subscription")
            &&text(n,"client_reference_id").equals(a.getCheckoutKey())&&text(n.path("metadata"),"argos_billing_id").equals(a.getBindingId())
            &&text(n.path("metadata"),"argos_price_id").equals(a.getCheckoutPriceId())
            &&time(n,"expires_at").equals(a.getCheckoutExpiresAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS)));
        require(Set.of("open","complete","expired").contains(text(n,"status")));
        if(lines){var items=n.path("line_items");require(items.path("data").isArray()&&items.path("data").size()==1&&!bool(items,"has_more"));
            var item=items.path("data").get(0);require(number(item,"quantity")==1);reader.price(item.path("price"),a.getCheckoutInterval(),false);}
    }
    public Destination portal(String auth,String csrf,String lang,String remote){
        long owner=actor(auth,csrf,remote);settings.requireEnabled();var claimed=store.claim(owner,false);
        try{
            if(claimed.getCustomerId()==null)throw new BillingError("billing_sync_pending");
            var reader=new StripeBillingReader(gateway,settings,clock.instant());reader.environment();reader.customer(claimed);
            var config=reader.get("/v1/billing_portal/configurations/"+settings.id("portal-config-id"),Map.of());
            type(config,"billing_portal.configuration");reader.mode(config);
            require(bool(config,"active")&&text(config,"id").equals(settings.id("portal-config-id")));
            var f=config.path("features");
            require(bool(f.path("invoice_history"),"enabled")&&bool(f.path("payment_method_update"),"enabled")
                &&bool(f.path("subscription_cancel"),"enabled")&&text(f.path("subscription_cancel"),"mode").equals("at_period_end")
                &&!bool(f.path("subscription_update"),"enabled"));
            store.update(claimed,row->{}); // Revalidate the persisted owner lease immediately before the provider POST.
            String page=returnOrigin()+(lang.equals("en")?"/en":"")+"/account/billing";
            var n=reader.post("/v1/billing_portal/sessions",Map.of("customer",claimed.getCustomerId(),
                "configuration",settings.id("portal-config-id"),"return_url",page,"locale",lang),"argos-portal-"+UUID.randomUUID());
            type(n,"billing_portal.session");reader.mode(n);
            require(text(n,"customer").equals(claimed.getCustomerId())&&text(n,"return_url").equals(page)
                &&text(n,"configuration").equals(settings.id("portal-config-id")));
            return new Destination(destination(text(n,"url"),true));
        }catch(BillingError e){throw e;}catch(Exception ignored){throw BillingError.unavailable();}finally{store.release(claimed);}
    }
    private String returnOrigin(){
        URI target=URI.create(accounts.origin());
        require("https".equals(target.getScheme())&&target.getHost()!=null&&target.getUserInfo()==null
            &&target.getRawQuery()==null&&target.getRawFragment()==null&&(target.getPath().isEmpty()||target.getPath().equals("/")));
        return accounts.origin().replaceAll("/+$","");
    }
    public void sync(String auth,String csrf,String remote){long owner=actor(auth,csrf,remote);settings.requireEnabled();reconcile(owner);}
    public void reconcile(long owner){
        settings.requireEnabled();
        var claimed=store.claim(owner,false);
        try{
            var reader=new StripeBillingReader(gateway,settings,clock.instant());reader.environment();
            var a=claimed.getCustomerId()==null?recoverCustomer(claimed,reader):claimed;
            if(a.getCustomerId()==null)throw new BillingError("billing_sync_pending");
            reader.customer(a);store.project(a,reader.read(a));
        }catch(BillingError failed){store.failure(claimed,failed.code());throw failed;}
        catch(Exception ignored){store.failure(claimed,"billing_unavailable");throw BillingError.unavailable();}
        finally{store.release(claimed);}
    }
    /** Search is read only and eventually consistent: an empty result never authorizes a new POST after the replay window. */
    private BillingAccount recoverCustomer(BillingAccount a,StripeBillingReader reader){
        require(a.getBindingId().matches("[a-f0-9-]{36}"));
        var n=reader.get("/v1/customers/search",Map.of("query","metadata['argos_billing_id']:'"+a.getBindingId()+"'","limit","100"));
        type(n,"search_result");require(n.path("data").isArray()&&!bool(n,"has_more")&&n.path("data").size()<=1);
        if(n.path("data").isEmpty())return a;
        var customer=n.path("data").get(0);type(customer,"customer");reader.mode(customer);
        require(text(customer.path("metadata"),"argos_billing_id").equals(a.getBindingId()));String id=id(customer,"id","cus");
        return store.update(a,row->{row.setCustomerId(id);if(row.getPhase().equals("CUSTOMER_PENDING"))row.setPhase("NONE");});
    }
    public void tick(){
        if(!settings.enabled())return;
        try{store.expire();store.purgeEvents();long deadline=System.nanoTime()+Duration.ofSeconds(45).toNanos();
            for(long owner:store.due()){if(System.nanoTime()+Duration.ofSeconds(25).toNanos()>deadline)break;
                try{reconcile(owner);}catch(Exception ignored){/* Controlled persistent diagnostic, no provider PII in scheduler logs. */}}}
        catch(Exception ignored){org.slf4j.LoggerFactory.getLogger(BillingService.class).warn("billing_reconciliation_unavailable");}
    }
    /** Validate before returning and again in the BFF/client. These bearer URLs are never logged or persisted. */
    public static String destination(String value,boolean portal){
        try{URI u=URI.create(value);require(value.length()<=4096&&u.getScheme().equals("https")&&u.getUserInfo()==null&&u.getPort()==-1
            &&(portal?"billing.stripe.com":"checkout.stripe.com").equals(u.getHost())
            &&(portal?(u.getPath().equals("/p/session")||u.getPath().startsWith("/p/session/")):u.getPath().startsWith("/c/pay/")));
            return value;
        }catch(Exception ignored){throw new BillingError("billing_configuration");}
    }
}
