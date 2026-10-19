package com.dokor.argos.services.billing;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class BillingSettingsTest {
    @Test void defaultsDoNotRequireOrInventPricesAndBlockEveryProviderOperation(){
        var s=new BillingSettings(ConfigFactory.load());assertFalse(s.enabled());assertFalse(s.payments());assertFalse(s.pricesApproved());
        assertThrows(BillingError.class,s::requireEnabled);assertThrows(BillingError.class,s::requirePayments);
    }
    @Test void approvedEurPricesAndIndependentReleaseGatesAreMandatory(){
        assertTrue(new BillingSettings(BillingFixtures.config()).payments());
        for(String value:new String[]{"billing.launch-approved=false","billing.prices-approved=false","billing.tax-ready=false",
            "billing.monthly-amount-ht-cents=0","billing.monthly-amount-ht-cents=1000.5","billing.annual-amount-ht-cents=12000",
            "billing.annual-price-id=price_month733","billing.account-id=bad","billing.api-key="+"rk_live_"+"fixture".repeat(4)}){
            assertThrows(IllegalArgumentException.class,()->new BillingSettings(ConfigFactory.parseString(value).withFallback(BillingFixtures.config())),value);
        }
    }
}
