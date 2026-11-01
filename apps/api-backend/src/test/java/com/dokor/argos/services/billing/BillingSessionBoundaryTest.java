package com.dokor.argos.services.billing;

import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.CiPolicy;
import com.fasterxml.jackson.databind.JsonNode;
import com.typesafe.config.ConfigFactory;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiFunction;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.dokor.argos.services.billing.BillingFixtures.*;

class BillingSessionBoundaryTest {
    @ParameterizedTest @ValueSource(booleans={false,true}) @SuppressWarnings("unchecked")
    void revocationDuringProviderReadsOrReplyNeverReturnsThePortalBearerUrl(boolean afterPost){
        var revoked=new AtomicBoolean();var a=row();var store=mock(BillingStore.class);
        var sessions=mock(AccountSessionService.class);var user=new AccountUser();user.setId(733L);
        when(sessions.with(anyString(),nullable(String.class),anyBoolean(),anyBoolean(),any())).thenAnswer(inv->{
            if(revoked.get())throw AccountError.unauthorized();
            BiFunction<AccountSessionService.Context,Connection,Object> work=inv.getArgument(4);
            return work.apply(new AccountSessionService.Context(user,new AccountSession()),null);
        });
        when(store.claimPortal(733)).thenReturn(a);when(store.update(any(),any())).thenReturn(a);
        var gateway=new Gateway(){
            @Override public JsonNode get(String path,Map<String,String> query){
                var result=super.get(path,query);
                if(!afterPost&&path.startsWith("/v1/billing_portal/configurations/"))revoked.set(true);
                return result;
            }
            @Override public JsonNode post(String path,Map<String,String> form,String key){
                assertEquals("/v1/billing_portal/sessions",path);requests.add("POST "+path);revoked.set(true);
                return obj("billing_portal.session").put("customer",CUSTOMER).put("configuration","bpc_fixture733")
                    .put("return_url",form.get("return_url")).put("url","https://billing.stripe.com/p/session?secret=fixture_only");
            }
        };
        var configuration=obj("billing_portal.configuration").put("id","bpc_fixture733").put("active",true);
        var features=configuration.putObject("features");features.putObject("invoice_history").put("enabled",true);
        features.putObject("payment_method_update").put("enabled",true);features.putObject("subscription_cancel").put("enabled",true).put("mode","at_period_end");
        features.putObject("subscription_update").put("enabled",false);gateway.reads.put("/v1/billing_portal/configurations/bpc_fixture733",configuration);
        var cfg=ConfigFactory.parseString("account.origin=\"https://argos.lelouet.fr\"").withFallback(config());
        var service=new BillingService(new BillingSettings(cfg),store,gateway,sessions,new AccountSettings(cfg),mock(AccountRateLimiter.class),
            Clock.fixed(NOW,ZoneOffset.UTC),new CiPolicy(ConfigFactory.load()));
        var rejected=assertThrows(AccountError.class,()->service.portal("owner","c".repeat(43),"fr","local"));
        assertEquals(401,rejected.getResponse().getStatus());
        assertFalse(rejected.getResponse().getEntity().toString().contains("secret="));
        assertEquals(afterPost?1:0,gateway.requests.stream().filter(p->p.startsWith("POST ")).count());
        verify(store).release(a);
    }
}
