package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.billing.*;
import com.dokor.argos.services.ci.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.querydsl.sql.*;
import com.typesafe.config.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.BiFunction;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.dokor.argos.services.billing.BillingFixtures.*;

@EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL",matches=".+")
class BillingIT extends MariaDbReportFixture {
    private static class MutableClock extends Clock {Instant value=NOW;public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}public Instant instant(){return value;}}
    private MutableClock clock;private BillingStore store;private BillingService service;private AccountSessionService sessions;private AccountDao dao;private FlowGateway gateway;
    @BeforeEach @SuppressWarnings("unchecked") void setupBilling()throws Exception{
        clock=new MutableClock();var tx=new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT));dao=new AccountDao(tx);
        var cfg=ConfigFactory.parseString("account.origin=\"https://argos.lelouet.fr\"").withFallback(config());var settings=new BillingSettings(cfg);
        store=new BillingStore(dao,settings,clock);gateway=new FlowGateway();sessions=mock(AccountSessionService.class);
        when(sessions.with(anyString(),nullable(String.class),anyBoolean(),anyBoolean(),any())).thenAnswer(inv->{
            long owner=inv.<String>getArgument(0).equals("other")?734L:733L;
            BiFunction<AccountSessionService.Context,Connection,Object> work=inv.getArgument(4);
            return dao.transaction(c->{var user=dao.user(owner,c,true);if(user==null||!user.getState().equals("ACTIVE"))throw AccountError.unauthorized();
                return work.apply(new AccountSessionService.Context(user,new AccountSession()),c);});
        });
        service=new BillingService(settings,store,gateway,sessions,new AccountSettings(cfg),mock(AccountRateLimiter.class),clock,new CiPolicy(ConfigFactory.load()));
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,offer,created_at) VALUES(733,'billing@example.com','Billing fixture','ACTIVE','FREE',NOW()),(734,'other@example.com','Other fixture','ACTIVE','FREE',NOW())");
        sql("INSERT INTO ARG_BILLING_ACCOUNT(id,binding_id,stripe_account,live_mode,next_sync_at) VALUES(733,'"+BINDING+"','acct_fixture733',0,'2026-10-19 12:00:00')");
    }
    private BillingAccount row(){return dao.transaction(c->store.read(733,c));}
    private void customer()throws Exception{sql("UPDATE ARG_BILLING_ACCOUNT SET customer_id='"+CUSTOMER+"' WHERE id=733");}
    private String offer()throws Exception{try(var c=source.getConnection();var s=c.prepareStatement("SELECT offer FROM ARG_ACCOUNT_USER WHERE id=733");var r=s.executeQuery()){assertTrue(r.next());return r.getString(1);}}
    private boolean access()throws Exception{try(var c=source.getConnection();var s=c.prepareStatement("SELECT ci_access FROM ARG_ACCOUNT_CI_ENTITLEMENT WHERE id=733");var r=s.executeQuery()){return r.next()&&r.getBoolean(1);}}
    @Test void migrationAndQuerydslRoundtripHaveNoAutomaticGrant()throws Exception{
        assertEquals(BINDING,row().getBindingId());assertEquals(0L,row().getSyncGeneration());assertFalse(access());assertEquals("FREE",offer());
        var r=service.status("owner");assertFalse(r.ciEnabled());assertEquals(0,gateway.requests.size());
        assertFalse(mapper.writeValueAsString(r).contains("cus_"));
    }
    @Test void verifiedPaidStateProjectsBoundedGrantAndCancellationKeepsItsPaidEnd()throws Exception{
        customer();service.reconcile(733);assertTrue(access());assertEquals("PREMIUM",offer());
        var q=QAccountCiEntitlement.table;var e=dao.transactions.selectQuery().select(q).from(q).where(q.id.eq(733L)).fetchOne();
        assertEquals("STRIPE",e.getGrantSource());assertEquals(NOW.plusSeconds(900),e.getValidUntil());
        gateway.node("/v1/subscriptions/"+SUB).put("cancel_at_period_end",true);service.reconcile(733);
        assertTrue(access());assertEquals("CANCEL_AT_PERIOD_END",row().getStatus());assertEquals(END,row().getPeriodEnd());
        assertTrue(gateway.requests.stream().allMatch(p->p.startsWith("GET ")));
    }
    @Test void unpaidRefundAndExpiryRevokeOnlyNewRightsWithoutDeletingReportsOrKeys()throws Exception{
        customer();service.reconcile(733);gateway.node("/v1/charges/ch_fixture733").put("amount_refunded",1);service.reconcile(733);
        assertFalse(access());assertEquals("FREE",offer());assertEquals("REFUNDED",row().getStatus());
        try(var c=source.getConnection();var s=c.prepareStatement("SELECT COUNT(*) FROM ARG_AUDIT_REPORT");var r=s.executeQuery()){r.next();assertEquals(3,r.getInt(1));}
        gateway.node("/v1/charges/ch_fixture733").put("amount_refunded",0);service.reconcile(733);assertTrue(access());
        clock.value=NOW.plusSeconds(901);store.expire();assertFalse(access());assertEquals("FREE",offer());
    }
    @Test void delayedAndDuplicatedEventsQueueOnceAndReadCurrentState()throws Exception{
        customer();byte[] digest=new byte[32];store.event(733,"evt_duplicate733","invoice.paid",digest);store.event(733,"evt_duplicate733","invoice.paid",digest);
        assertEquals(1L,row().getSyncGeneration());assertFalse(access());
        gateway.node("/v1/subscriptions/"+SUB).put("status","unpaid");service.reconcile(733);
        assertEquals("PAYMENT_REQUIRED",row().getStatus());assertFalse(access());assertEquals("FREE",offer());
        byte[] changed=new byte[32];changed[0]=1;assertThrows(BillingError.class,()->store.event(733,"evt_duplicate733","invoice.paid",changed));
    }
    @Test void webhookDuringReadFencesOutAnOlderProjection()throws Exception{
        customer();var claim=store.claim(733,false);store.event(733,"evt_newer733","invoice.payment_failed",new byte[32]);
        assertThrows(BillingError.class,()->store.project(claim,new StripeBillingReader.Projection("ACTIVE","MONTH",END,SUB,"ch_fixture733",true)));
        assertFalse(access());store.release(claim);assertNull(row().getLeaseToken());assertEquals(1L,row().getSyncGeneration());
    }
    @Test void accountLockSerializesClaimsAndPreventsConcurrentCustomerOrCheckoutCreation()throws Exception{
        var first=store.claim(733,false);var pool=Executors.newSingleThreadExecutor();
        try{assertThrows(ExecutionException.class,()->pool.submit(()->store.claim(733,false)).get(5,TimeUnit.SECONDS));}
        finally{pool.shutdownNow();store.release(first);}
    }
    @Test void browserReturnAndReadOnlySnapshotNeverGrantAnything()throws Exception{
        customer();for(int i=0;i<3;i++)service.status("owner");assertEquals("FREE",offer());assertFalse(access());assertTrue(gateway.requests.isEmpty());
    }
    @Test void timeoutAfterProviderCreatedCheckoutRecoversSameIntentWithoutAnotherPost()throws Exception{
        gateway.emptySubscriptions();gateway.loseCheckoutResponse=true;
        assertThrows(BillingError.class,()->service.checkout("owner","c".repeat(43),"MONTH","fr","local"));
        String intent=row().getCheckoutKey();assertNotNull(intent);assertEquals(1,gateway.checkoutPosts);
        var result=service.checkout("owner","c".repeat(43),"MONTH","en","local");
        assertEquals("https://checkout.stripe.com/c/pay/cs_test_fixture733",result.url());assertEquals(intent,row().getCheckoutKey());
        assertEquals(1,gateway.customerPosts);assertEquals(1,gateway.checkoutPosts);assertEquals("fr",row().getCheckoutLang());assertFalse(access());
        assertThrows(BillingError.class,()->service.checkout("owner","c".repeat(43),"YEAR","fr","local"));assertEquals(1,gateway.checkoutPosts);
    }
    @Test void portalCannotBeOpenedForAnotherAccountOrWithoutRecentReauthentication()throws Exception{
        customer();assertThrows(BillingError.class,()->service.portal("other","c".repeat(43),"fr","local"));assertTrue(gateway.requests.isEmpty());
        doThrow(AccountError.forbidden("reauth_required")).when(sessions).recent(any());
        assertThrows(AccountError.class,()->service.portal("owner","c".repeat(43),"fr","local"));assertTrue(gateway.requests.isEmpty());
    }
    @Test void manualGrantsAndConcurrentAdministrativeOfferChangesAreNotOverwritten()throws Exception{
        customer();sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES(733,1,'2027-10-19 12:00:00',NOW())");
        assertThrows(BillingError.class,()->service.reconcile(733));assertEquals("FREE",offer());assertTrue(access());
        sql("DELETE FROM ARG_ACCOUNT_CI_ENTITLEMENT WHERE id=733");service.reconcile(733);sql("UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id=733");
        assertThrows(BillingError.class,()->service.reconcile(733));assertEquals("FREE",offer());
    }
    @Test void accountClosureCannotStrandAnActiveOrUncertainPayment()throws Exception{
        var auth=new AccountAuthService(dao,null,sessions,null,new AccountSettings(config()),null,clock);
        for(String state:List.of("ACTIVE","CANCEL_AT_PERIOD_END","PAYMENT_REQUIRED","REFUNDED","DISPUTED")){
            sql("UPDATE ARG_BILLING_ACCOUNT SET status='"+state+"' WHERE id=733");
            assertThrows(AccountError.class,()->auth.archive("owner","csrf",true));
        }
        sql("UPDATE ARG_BILLING_ACCOUNT SET status='NONE',phase='OPEN' WHERE id=733");
        assertThrows(AccountError.class,()->auth.archive("owner","csrf",true));
        for(String phase:List.of("CUSTOMER_PENDING","CHECKOUT_PENDING","OPEN")){
            sql("UPDATE ARG_BILLING_ACCOUNT SET status='ENDED',phase='"+phase+"' WHERE id=733");
            assertThrows(AccountError.class,()->auth.archive("owner","csrf",true));
        }
        sql("UPDATE ARG_BILLING_ACCOUNT SET status='ENDED',phase='COMPLETE' WHERE id=733");
        auth.archive("owner","csrf",true);
        try(var c=source.getConnection()){assertEquals("ARCHIVED",dao.user(733,c,false).getState());}
    }
    @Test void invoiceAndCancellationPortalSurvivesManualEntitlementChangesWithoutGrantingRights()throws Exception{
        customer();sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES(733,0,'2027-10-19 12:00:00',NOW())");
        var configuration=obj("billing_portal.configuration").put("id","bpc_fixture733").put("active",true);
        var features=configuration.putObject("features");features.putObject("invoice_history").put("enabled",true);
        features.putObject("payment_method_update").put("enabled",true);features.putObject("subscription_cancel").put("enabled",true).put("mode","at_period_end");
        features.putObject("subscription_update").put("enabled",false);gateway.reads.put("/v1/billing_portal/configurations/bpc_fixture733",configuration);
        assertEquals("https://billing.stripe.com/p/session?secret=fixture_only",service.portal("owner","c".repeat(43),"en","local").url());
        assertFalse(access());assertEquals("FREE",offer());assertThrows(BillingError.class,()->service.reconcile(733));
        ((ObjectNode)features.path("subscription_update")).put("enabled",true);
        assertThrows(BillingError.class,()->service.portal("owner","c".repeat(43),"en","local"));
        assertEquals(1,gateway.requests.stream().filter(p->p.equals("POST /v1/billing_portal/sessions")).count());
    }
    private static class FlowGateway extends Gateway {
        int customerPosts,checkoutPosts;boolean loseCheckoutResponse;
        void emptySubscriptions(){reads.put("/v1/subscriptions",list());}
        @Override public JsonNode post(String path,Map<String,String> data,String key){
            requests.add("POST "+path);
            if(path.equals("/v1/billing_portal/sessions"))return obj("billing_portal.session").put("customer",data.get("customer"))
                .put("configuration",data.get("configuration")).put("return_url",data.get("return_url")).put("url","https://billing.stripe.com/p/session?secret=fixture_only");
            if(path.equals("/v1/customers")){customerPosts++;assertEquals("argos-customer-"+BINDING,key);return reads.get("/v1/customers/"+CUSTOMER).deepCopy();}
            if(path.equals("/v1/checkout/sessions")){
                checkoutPosts++;assertTrue(key.startsWith("argos-checkout-"));assertEquals("true",data.get("automatic_tax[enabled]"));assertEquals("1",data.get("line_items[0][quantity]"));
                assertFalse(data.keySet().stream().anyMatch(k->k.contains("price_data")||k.equals("customer_email")||k.contains("trial")));
                var n=obj("checkout.session").put("id","cs_test_fixture733").put("customer",CUSTOMER).put("mode","subscription").put("status","open")
                    .put("client_reference_id",data.get("client_reference_id")).put("expires_at",Long.parseLong(data.get("expires_at")))
                    .put("url","https://checkout.stripe.com/c/pay/cs_test_fixture733");
                n.putObject("metadata").put("argos_billing_id",BINDING).put("argos_price_id",data.get("line_items[0][price]"));
                n.set("line_items",list(obj("item").put("quantity",1).set("price",price("MONTH"))));
                reads.put("/v1/checkout/sessions/cs_test_fixture733",n);reads.put("/v1/checkout/sessions",list(n));
                if(loseCheckoutResponse){loseCheckoutResponse=false;throw BillingError.unavailable();}return n.deepCopy();
            }
            throw new AssertionError("Unexpected financial operation");
        }
    }
}
