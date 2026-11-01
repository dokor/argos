package com.dokor.argos.services.billing;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
class StripeBillingReaderTest {
    private BillingFixtures.Gateway gateway;private BillingSettings settings;
    @BeforeEach void setup(){gateway=new BillingFixtures.Gateway();settings=new BillingSettings(BillingFixtures.config());}
    private StripeBillingReader.Projection read(){return new StripeBillingReader(gateway,settings,BillingFixtures.NOW).read(BillingFixtures.row());}
    @Test void activePaidVerifiedSubscriptionGrantsOnlyUntilItsPaidPeriod(){var p=read();assertTrue(p.paid());assertEquals("ACTIVE",p.status());assertEquals(BillingFixtures.END,p.periodEnd());
        assertTrue(gateway.requests.stream().allMatch(pth->pth.startsWith("GET ")));}
    @Test void cancellationKeepsPaidAccessUntilPeriodEnd(){gateway.node("/v1/subscriptions/"+BillingFixtures.SUB).put("cancel_at_period_end",true);var p=read();assertTrue(p.paid());assertEquals("CANCEL_AT_PERIOD_END",p.status());}
    @Test void incompletePastDueUnpaidTrialOrPauseNeverGrant(){
        for(String state:new String[]{"incomplete","past_due","unpaid","trialing","paused"}){
            gateway.node("/v1/subscriptions/"+BillingFixtures.SUB).put("status",state);assertFalse(read().paid(),state);}
    }
    @Test void paidInvoiceWithoutSuccessfulChargeDoesNotGrant(){gateway.node("/v1/payment_intents/pi_fixture733").put("status","processing");assertThrows(BillingError.class,this::read);}
    @Test void partialRefundAndDisputeSuspendNewAccess(){
        gateway.node("/v1/charges/ch_fixture733").put("amount_refunded",1);assertEquals("REFUNDED",read().status());assertFalse(read().paid());
        gateway.node("/v1/charges/ch_fixture733").put("amount_refunded",0).put("disputed",true);assertEquals("DISPUTED",read().status());assertFalse(read().paid());
    }
    @Test void foreignCustomerModePriceTaxOrOldPaidPeriodFailClosed(){
        for(java.util.function.Consumer<BillingFixtures.Gateway> corrupt:java.util.List.<java.util.function.Consumer<BillingFixtures.Gateway>>of(
            g->g.node("/v1/subscriptions/"+BillingFixtures.SUB).put("customer","cus_foreign733"),
            g->g.node("/v1/subscriptions/"+BillingFixtures.SUB).put("livemode",true),
            g->((com.fasterxml.jackson.databind.node.ObjectNode)g.node("/v1/subscriptions/"+BillingFixtures.SUB).path("items").path("data").get(0).path("price")).put("tax_behavior","inclusive"),
            g->((com.fasterxml.jackson.databind.node.ObjectNode)g.node("/v1/invoices/in_fixture733").path("lines").path("data").get(0).path("period")).put("start",BillingFixtures.NOW.minusSeconds(86400).getEpochSecond()),
            g->g.node("/v1/invoices/in_fixture733").put("total_excluding_tax",999))){
            gateway=new BillingFixtures.Gateway();corrupt.accept(gateway);assertThrows(BillingError.class,this::read);
        }
    }
    @Test void duplicateSubscriptionsOrTruncatedPaginationCannotLookLikeNoSubscription(){
        gateway.reads.put("/v1/subscriptions",BillingFixtures.list(gateway.node("/v1/subscriptions/"+BillingFixtures.SUB),gateway.node("/v1/subscriptions/"+BillingFixtures.SUB)));
        assertThrows(BillingError.class,this::read);gateway.reads.put("/v1/subscriptions",BillingFixtures.list().put("has_more",true));assertThrows(BillingError.class,this::read);
    }
    @Test void wrongStripeAccountIsRejectedBeforeMutation(){gateway.node("/v1/account").put("id","acct_foreign733");assertThrows(BillingError.class,()->new StripeBillingReader(gateway,settings,BillingFixtures.NOW).environment());}
}
