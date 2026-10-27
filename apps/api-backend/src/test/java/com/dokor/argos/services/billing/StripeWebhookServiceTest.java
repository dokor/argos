package com.dokor.argos.services.billing;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StripeWebhookServiceTest {
    private final Clock clock=Clock.fixed(BillingFixtures.NOW,ZoneOffset.UTC);
    private final BillingStore store=mock(BillingStore.class);
    private final StripeWebhookService service=new StripeWebhookService(new BillingSettings(BillingFixtures.config()),store,clock,new ObjectMapper());
    private byte[] payload(){return ("""
      {"id":"evt_fixture733","object":"event","api_version":"%s","livemode":false,"type":"customer.subscription.updated",
       "data":{"object":{"id":"sub_fixture733","object":"subscription","customer":"%s","status":"active"}}}
      """.formatted(BillingSettings.API_VERSION,BillingFixtures.CUSTOMER)).getBytes(StandardCharsets.UTF_8);}
    private String signature(byte[] body,long time)throws Exception{var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(BillingFixtures.SECRET.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        mac.update((time+".").getBytes(StandardCharsets.US_ASCII));return "t="+time+",v1="+HexFormat.of().formatHex(mac.doFinal(body));}
    @Test void validSignedActiveSnapshotOnlyQueuesAuthoritativeReconciliation()throws Exception{
        when(store.owner(BillingFixtures.CUSTOMER,null)).thenReturn(733L);byte[] b=payload();
        service.accept(new ByteArrayInputStream(b),signature(b,clock.instant().getEpochSecond()),"application/json",null);
        verify(store).owner(BillingFixtures.CUSTOMER,null);verify(store).event(eq(733L),eq("evt_fixture733"),eq("customer.subscription.updated"),argThat(hash->hash.length==32));
        verifyNoMoreInteractions(store);
    }
    @Test void disabledWebhookDoesNotReadItsBodyOrTouchState(){
        var body=mock(InputStream.class);var disabled=new StripeWebhookService(new BillingSettings(com.typesafe.config.ConfigFactory.load()),store,clock,new ObjectMapper());
        assertThrows(BillingError.class,()->disabled.accept(body,"ignored","application/json",null));verifyNoInteractions(body,store);
    }
    @Test void staleFutureWrongOrTamperedSignaturesDoNotReachDatabase()throws Exception{
        byte[] b=payload();long time=clock.instant().getEpochSecond();
        for(String sig:List.of(signature(b,time-301),signature(b,time+301),signature(b,time).replace("v1=","v0="),
            signature(b,time)+",t="+time,"t="+time+",v1="+"0".repeat(64))){
            assertThrows(BillingError.class,()->service.accept(new ByteArrayInputStream(b),sig,"application/json",null));
        }
        String signed=signature(b,time);b[5]^=1;byte[] modified=b;
        assertThrows(BillingError.class,()->service.accept(new ByteArrayInputStream(modified),signed,"application/json",null));verifyNoInteractions(store);
    }
    @Test void wrongEnvironmentConnectVersionAndCompressedBodiesAreRejected()throws Exception{
        String original=new String(payload(),StandardCharsets.UTF_8);
        for(String invalid:List.of(original.replace("\"livemode\":false","\"livemode\":true"),original.replace("\"object\":\"event\"","\"object\":\"event\",\"account\":\"acct_foreign733\""),
            original.replace(BillingSettings.API_VERSION,"1900-01-01"),original.replace("\"livemode\":false","\"livemode\":false,\"livemode\":false"))){
            byte[] body=invalid.getBytes(StandardCharsets.UTF_8);String sig=signature(body,clock.instant().getEpochSecond());assertThrows(BillingError.class,()->service.accept(new ByteArrayInputStream(body),sig,"application/json",null));
        }
        byte[] b=payload();assertThrows(BillingError.class,()->service.accept(new ByteArrayInputStream(b),signature(b,clock.instant().getEpochSecond()),"application/json","gzip"));verifyNoInteractions(store);
    }
    @Test void tooLargeBodyIsBoundedBeforeJsonParsing()throws Exception{
        byte[] b=new byte[262145];assertThrows(BillingError.class,()->service.accept(new ByteArrayInputStream(b),signature(b,clock.instant().getEpochSecond()),"application/json",null));verifyNoInteractions(store);
    }
    @Test void unknownCustomerIsIgnoredWithoutProvisioning()throws Exception{
        when(store.owner(BillingFixtures.CUSTOMER,null)).thenReturn(null);
        byte[] b=payload();service.accept(new ByteArrayInputStream(b),signature(b,clock.instant().getEpochSecond()),"application/json",null);
        verify(store).owner(BillingFixtures.CUSTOMER,null);verifyNoMoreInteractions(store);
    }
    @Test void minimalDiagnosticNeverContainsProviderData(){
        var e=new BillingError("billing_unavailable");String output=String.valueOf(e.getResponse().getEntity());
        assertTrue(output.contains("billing_unavailable"));assertFalse(output.contains("cus_"));assertFalse(output.contains("whsec_"));assertFalse(output.contains("fixture"));
    }
}
