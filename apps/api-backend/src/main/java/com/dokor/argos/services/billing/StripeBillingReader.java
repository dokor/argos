package com.dokor.argos.services.billing;

import com.dokor.argos.db.generated.BillingAccount;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.*;
import static com.dokor.argos.services.billing.StripeObjects.*;

/** Reads authoritative provider state. Webhook snapshots and browser return parameters are not grants. */
public final class StripeBillingReader {
    public record Projection(String status,String interval,Instant periodEnd,String subscriptionId,String chargeId,boolean paid){}
    private final StripeGateway gateway;private final BillingSettings settings;private final Instant now;
    private final long deadline=System.nanoTime()+Duration.ofSeconds(25).toNanos();private int calls;
    public StripeBillingReader(StripeGateway gateway,BillingSettings settings,Instant now){this.gateway=gateway;this.settings=settings;this.now=now;}
    private void budget(){if(++calls>24||System.nanoTime()+Duration.ofSeconds(8).toNanos()>deadline)throw BillingError.unavailable();}
    public JsonNode get(String path,Map<String,String> query){budget();return gateway.get(path,query);}
    public JsonNode post(String path,Map<String,String> data,String key){budget();return gateway.post(path,data,key);}
    public void environment(){var n=get("/v1/account",Map.of());type(n,"account");require(id(n,"id","acct").equals(settings.id("account-id")));}
    public void mode(JsonNode n){require(bool(n,"livemode")==settings.live());}
    public void prices(){for(String interval:new String[]{"MONTH","YEAR"})price(get("/v1/prices/"+settings.price(interval),Map.of()),interval,true);}
    public void price(JsonNode n,String interval,boolean available){
        type(n,"price");mode(n);require(id(n,"id","price").equals(settings.price(interval)));
        require(text(n,"currency").equals("eur")&&number(n,"unit_amount")==settings.amount(interval)
            &&text(n,"product").equals(settings.id("product-id"))&&text(n,"tax_behavior").equals("exclusive")
            &&text(n,"type").equals("recurring")&&text(n,"billing_scheme").equals("per_unit"));
        require(n.path("custom_unit_amount").isNull()&&n.path("transform_quantity").isNull());
        require(text(n.path("recurring"),"interval").equals(interval.equals("MONTH")?"month":"year")
            &&number(n.path("recurring"),"interval_count")==1&&text(n.path("recurring"),"usage_type").equals("licensed"));
        if(available)require(bool(n,"active"));
    }
    public void customer(BillingAccount a){var n=get("/v1/customers/"+a.getCustomerId(),Map.of());type(n,"customer");mode(n);
        require(id(n,"id","cus").equals(a.getCustomerId())&&text(n.path("metadata"),"argos_billing_id").equals(a.getBindingId())&&!n.path("deleted").asBoolean(false));}
    public List<JsonNode> list(String path,Map<String,String> filter){
        var result=new ArrayList<JsonNode>();var query=new HashMap<>(filter);query.put("limit","100");var seen=new HashSet<String>();
        for(int page=0;page<10;page++){
            var n=get(path,query);type(n,"list");require(n.path("data").isArray()&&n.path("data").size()<=100);boolean more=bool(n,"has_more");
            for(var item:n.path("data")){String value=text(item,"id");require(seen.add(value));result.add(item);}
            if(!more)return List.copyOf(result);
            require(!n.path("data").isEmpty());query.put("starting_after",text(n.path("data").get(n.path("data").size()-1),"id"));
        }
        throw new BillingError("billing_sync_pending");
    }
    public Projection read(BillingAccount a){
        var all=list("/v1/subscriptions",Map.of("customer",a.getCustomerId(),"status","all"));
        var running=all.stream().filter(n->!Set.of("canceled","incomplete_expired").contains(text(n,"status"))).toList();
        if(running.size()>1)throw new BillingError("billing_existing_subscription");
        if(running.isEmpty()){
            if(a.getSubscriptionId()!=null){
                var previous=get("/v1/subscriptions/"+a.getSubscriptionId(),Map.of());type(previous,"subscription");mode(previous);
                require(text(previous,"customer").equals(a.getCustomerId())&&text(previous.path("metadata"),"argos_billing_id").equals(a.getBindingId()));
                if(!Set.of("canceled","incomplete_expired").contains(text(previous,"status")))throw new BillingError("billing_sync_pending");
            }
            return new Projection(a.getSubscriptionId()==null?"NONE":"ENDED",null,null,a.getSubscriptionId(),null,false);
        }
        var listed=running.getFirst();String sub=id(listed,"id","sub");
        var n=get("/v1/subscriptions/"+sub,Map.of());type(n,"subscription");mode(n);
        require(id(n,"id","sub").equals(sub)&&text(n,"customer").equals(a.getCustomerId())
            &&text(n.path("metadata"),"argos_billing_id").equals(a.getBindingId()));
        var items=n.path("items");type(items,"list");require(items.path("data").isArray()&&items.path("data").size()==1&&!bool(items,"has_more"));
        var item=items.path("data").get(0);require(number(item,"quantity")==1);
        String priceId=id(item.path("price"),"id","price"),interval=priceId.equals(settings.price("MONTH"))?"MONTH":priceId.equals(settings.price("YEAR"))?"YEAR":"";
        require(!interval.isEmpty());price(item.path("price"),interval,false);
        Instant start=time(item,"current_period_start"),end=time(item,"current_period_end");
        require(!start.isAfter(now)&&end.isAfter(start)&&end.isBefore(start.plus(Duration.ofDays(367))));
        String state=text(n,"status");
        require(Set.of("active","past_due","unpaid","incomplete","incomplete_expired","trialing","paused","canceled").contains(state));
        if(!state.equals("active")||!end.isAfter(now)||!n.path("pause_collection").isNull()||!n.path("pending_update").isNull())
            return new Projection(Set.of("canceled","incomplete_expired").contains(state)?"ENDED":"PAYMENT_REQUIRED",interval,end,sub,null,false);
        require(bool(n.path("automatic_tax"),"enabled")&&text(n,"collection_method").equals("charge_automatically"));
        var invoice=get("/v1/invoices/"+id(n,"latest_invoice","in"),Map.of());type(invoice,"invoice");mode(invoice);
        require(text(invoice,"customer").equals(a.getCustomerId())&&text(invoice,"currency").equals("eur")
            &&text(invoice.path("parent").path("subscription_details"),"subscription").equals(sub));
        boolean paid=text(invoice,"status").equals("paid")&&number(invoice,"amount_remaining")==0;
        if(!paid)return new Projection("PAYMENT_REQUIRED",interval,end,sub,null,false);
        require(Set.of("subscription_create","subscription_cycle").contains(text(invoice,"billing_reason"))
            &&bool(invoice.path("automatic_tax"),"enabled")&&text(invoice.path("automatic_tax"),"status").equals("complete")
            &&number(invoice,"total_excluding_tax")==settings.amount(interval)&&number(invoice,"total")>0
            &&number(invoice,"amount_paid")==number(invoice,"total")&&number(invoice,"amount_due")==number(invoice,"total"));
        var lines=invoice.path("lines");require(lines.path("data").isArray()&&lines.path("data").size()==1&&!bool(lines,"has_more"));
        require(time(lines.path("data").get(0).path("period"),"start").equals(start)&&time(lines.path("data").get(0).path("period"),"end").equals(end));
        var payments=list("/v1/invoice_payments",Map.of("invoice",text(invoice,"id")));
        var settled=payments.stream().filter(p->text(p,"status").equals("paid")).toList();require(settled.size()==1);
        var p=settled.getFirst();type(p,"invoice_payment");mode(p);
        require(text(p,"invoice").equals(text(invoice,"id"))&&text(p,"currency").equals("eur")&&number(p,"amount_paid")==number(invoice,"total"));
        require(text(p.path("payment"),"type").equals("payment_intent"));
        var intent=get("/v1/payment_intents/"+id(p.path("payment"),"payment_intent","pi"),Map.of());type(intent,"payment_intent");mode(intent);
        require(text(intent,"customer").equals(a.getCustomerId())&&text(intent,"currency").equals("eur")
            &&text(intent,"status").equals("succeeded")&&number(intent,"amount_received")==number(invoice,"total"));
        String chargeId=id(intent,"latest_charge","ch");var charge=get("/v1/charges/"+chargeId,Map.of());type(charge,"charge");mode(charge);
        require(text(charge,"customer").equals(a.getCustomerId())&&text(charge,"payment_intent").equals(text(intent,"id"))
            &&text(charge,"currency").equals("eur")&&bool(charge,"paid")&&bool(charge,"captured")&&number(charge,"amount")==number(invoice,"total"));
        if(bool(charge,"disputed"))return new Projection("DISPUTED",interval,end,sub,chargeId,false);
        if(number(charge,"amount_refunded")>0||bool(charge,"refunded"))return new Projection("REFUNDED",interval,end,sub,chargeId,false);
        // A late renewal/cancellation while invoice/charge were read cannot combine incompatible snapshots.
        var finalSub=get("/v1/subscriptions/"+sub,Map.of());type(finalSub,"subscription");mode(finalSub);
        require(text(finalSub,"id").equals(sub)&&text(finalSub,"customer").equals(a.getCustomerId())
            &&finalSub.path("metadata").equals(n.path("metadata"))&&text(finalSub,"status").equals("active")
            &&text(finalSub,"latest_invoice").equals(text(n,"latest_invoice"))
            &&finalSub.path("items").equals(items)&&finalSub.path("pause_collection").equals(n.path("pause_collection"))
            &&finalSub.path("pending_update").equals(n.path("pending_update"))&&finalSub.path("automatic_tax").equals(n.path("automatic_tax"))
            &&text(finalSub,"collection_method").equals(text(n,"collection_method"))&&bool(finalSub,"cancel_at_period_end")==bool(n,"cancel_at_period_end"));
        return new Projection(bool(n,"cancel_at_period_end")?"CANCEL_AT_PERIOD_END":"ACTIVE",interval,end,sub,chargeId,true);
    }
}
