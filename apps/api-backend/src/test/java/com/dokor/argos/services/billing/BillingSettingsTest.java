package com.dokor.argos.services.billing;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class BillingSettingsTest {
    @Test void approvedCatalogAmountsDoNotOpenAnyLaunchGateOrRequireProviderCredentials(){
        var s=new BillingSettings(ConfigFactory.load());assertFalse(s.enabled());assertFalse(s.payments());assertFalse(s.pricesApproved());
        assertEquals(1900L,s.configuredAmount("MONTH"));assertEquals(19900L,s.configuredAmount("YEAR"));
        assertEquals("",s.key());assertEquals("",s.price("MONTH"));assertEquals("",s.price("YEAR"));
        for(String gate:new String[]{"launch-approved","tax-ready"})assertFalse(ConfigFactory.load().getBoolean("billing."+gate));
        assertThrows(BillingError.class,s::requireEnabled);assertThrows(BillingError.class,s::requirePayments);
    }
    @Test void configuredDisplayPricesAreValidatedEvenWithEveryGateClosed(){
        var base=ConfigFactory.load();
        for(String value:new String[]{"billing.monthly-amount-ht-cents=null","billing.monthly-amount-ht-cents=0",
            "billing.annual-amount-ht-cents=19900.5","billing.annual-amount-ht-cents=22800"})
            assertThrows(IllegalArgumentException.class,()->new BillingSettings(ConfigFactory.parseString(value).withFallback(base)));
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
