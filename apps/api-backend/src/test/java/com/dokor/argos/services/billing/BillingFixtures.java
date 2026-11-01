package com.dokor.argos.services.billing;

import com.dokor.argos.db.generated.BillingAccount;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.typesafe.config.*;
import java.time.*;
import java.util.*;

/** Fictional minor-unit amounts and identifiers, never commercial defaults or provider credentials. */
public final class BillingFixtures {
    public static final Instant NOW=Instant.parse("2026-10-19T12:00:00Z"),END=NOW.plus(Duration.ofDays(30));
    public static final String BINDING="73300000-0000-4000-8000-000000000001",CUSTOMER="cus_fixture733",SUB="sub_fixture733";
    public static final String SECRET="whsec_"+"fixture".repeat(8);
    public static Config config(){return ConfigFactory.parseString("""
        billing {
          enabled=true
          payments-enabled=true
          launch-approved=true
          prices-approved=true
          tax-ready=true
          live-mode=false
          account-id=acct_fixture733
          product-id=prod_fixture733
          monthly-price-id=price_month733
          annual-price-id=price_year733
          monthly-amount-ht-cents=1000
          annual-amount-ht-cents=11000
          portal-config-id=bpc_fixture733
          api-key="%s"
          webhook-secret="%s"
        }
        """.formatted("rk_test_"+"fixture".repeat(6),SECRET)).withFallback(ConfigFactory.load());}
    public static BillingAccount row(){var a=new BillingAccount();a.setId(733L);a.setBindingId(BINDING);a.setCustomerId(CUSTOMER);
        a.setStripeAccount("acct_fixture733");a.setLiveMode(false);a.setStatus("NONE");a.setPhase("NONE");a.setSyncGeneration(0L);a.setManagedOffer(false);a.setAttempts(0);return a;}
    public static ObjectNode obj(String object){return new ObjectMapper().createObjectNode().put("object",object).put("livemode",false);}
    public static ObjectNode list(JsonNode... nodes){var n=obj("list").put("has_more",false);n.putArray("data").addAll(Arrays.asList(nodes));return n;}
    public static ObjectNode price(String interval){var n=obj("price").put("id",interval.equals("MONTH")?"price_month733":"price_year733")
        .put("currency","eur").put("unit_amount",interval.equals("MONTH")?1000:11000).put("product","prod_fixture733")
        .put("tax_behavior","exclusive").put("type","recurring").put("billing_scheme","per_unit").put("active",true);
        n.putNull("custom_unit_amount");n.putNull("transform_quantity");n.putObject("recurring").put("interval",interval.equals("MONTH")?"month":"year").put("interval_count",1).put("usage_type","licensed");return n;}
    public static class Gateway implements StripeGateway {
        public final Map<String,JsonNode> reads=new HashMap<>();public final List<String> requests=new ArrayList<>();
        public Gateway(){
            reads.put("/v1/account",obj("account").put("id","acct_fixture733"));
            var customer=obj("customer").put("id",CUSTOMER);customer.putObject("metadata").put("argos_billing_id",BINDING);reads.put("/v1/customers/"+CUSTOMER,customer);
            reads.put("/v1/prices/price_month733",price("MONTH"));reads.put("/v1/prices/price_year733",price("YEAR"));
            var sub=obj("subscription").put("id",SUB).put("customer",CUSTOMER).put("status","active").put("latest_invoice","in_fixture733")
                .put("cancel_at_period_end",false).put("collection_method","charge_automatically");
            sub.putObject("metadata").put("argos_billing_id",BINDING);sub.putObject("automatic_tax").put("enabled",true);
            sub.putNull("pause_collection");sub.putNull("pending_update");
            var item=obj("subscription_item").put("quantity",1).put("current_period_start",NOW.getEpochSecond()).put("current_period_end",END.getEpochSecond());
            item.set("price",price("MONTH"));sub.set("items",list(item));reads.put("/v1/subscriptions/"+SUB,sub);
            reads.put("/v1/subscriptions",list(sub));reads.put("/v1/checkout/sessions",list());
            var invoice=obj("invoice").put("id","in_fixture733").put("customer",CUSTOMER).put("currency","eur").put("status","paid")
                .put("amount_remaining",0).put("amount_paid",1000).put("amount_due",1000).put("total",1000).put("total_excluding_tax",1000).put("billing_reason","subscription_cycle");
            invoice.putObject("parent").putObject("subscription_details").put("subscription",SUB);
            invoice.putObject("automatic_tax").put("enabled",true).put("status","complete");
            var line=obj("line_item");line.putObject("period").put("start",NOW.getEpochSecond()).put("end",END.getEpochSecond());invoice.set("lines",list(line));reads.put("/v1/invoices/in_fixture733",invoice);
            var payment=obj("invoice_payment").put("id","inpay_fixture733").put("status","paid").put("currency","eur").put("invoice","in_fixture733").put("amount_paid",1000);
            payment.putObject("payment").put("type","payment_intent").put("payment_intent","pi_fixture733");reads.put("/v1/invoice_payments",list(payment));
            reads.put("/v1/payment_intents/pi_fixture733",obj("payment_intent").put("id","pi_fixture733").put("customer",CUSTOMER).put("currency","eur")
                .put("status","succeeded").put("amount_received",1000).put("latest_charge","ch_fixture733"));
            reads.put("/v1/charges/ch_fixture733",obj("charge").put("id","ch_fixture733").put("customer",CUSTOMER).put("payment_intent","pi_fixture733")
                .put("currency","eur").put("amount",1000).put("paid",true).put("captured",true).put("disputed",false).put("refunded",false).put("amount_refunded",0));
        }
        public ObjectNode node(String path){return (ObjectNode)reads.get(path);}
        @Override public JsonNode get(String path,Map<String,String> query){requests.add("GET "+path);if(!reads.containsKey(path))throw BillingError.unavailable();return reads.get(path).deepCopy();}
        @Override public JsonNode post(String path,Map<String,String> form,String key){requests.add("POST "+path);throw new AssertionError("No provider mutation expected");}
    }
}
