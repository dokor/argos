package com.dokor.argos.services.billing;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.*;
import jakarta.inject.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;

/** Raw-body HMAC + recency before JSON parsing; durable minimal receipt before ACK. No provider I/O. */
@Singleton
public final class StripeWebhookService {
    private final java.util.concurrent.Semaphore readers=new java.util.concurrent.Semaphore(8);
    private static final Set<String> TYPES=Set.of("checkout.session.completed","checkout.session.expired",
        "customer.subscription.created","customer.subscription.updated","customer.subscription.deleted",
        "invoice.paid","invoice.payment_failed","invoice.payment_action_required","invoice.marked_uncollectible",
        "charge.refunded","charge.dispute.created","charge.dispute.closed","charge.dispute.updated");
    private final BillingSettings settings;private final BillingStore store;private final Clock clock;private final ObjectMapper mapper;
    @Inject public StripeWebhookService(BillingSettings settings,BillingStore store,Clock clock,ObjectMapper mapper){
        this.settings=settings;this.store=store;this.clock=clock;this.mapper=mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
    }
    public void accept(InputStream stream,String signature,String contentType,String encoding){
        settings.requireEnabled();
        try{
            if(contentType==null||!contentType.matches("(?i)application/json(?:;\\s*charset=utf-8)?")||encoding!=null&&!encoding.equalsIgnoreCase("identity"))
                throw invalid();
            if(signature==null||signature.length()>4096)throw invalid();
            byte[] body=readBody(stream);if(body.length>262144)throw invalid();
            verify(body,signature,settings.webhookSecret(),clock.instant().getEpochSecond());
            var n=mapper.readTree(body);StripeObjects.type(n,"event");
            if(!n.path("livemode").isBoolean()||n.path("livemode").booleanValue()!=settings.live()
                ||!BillingSettings.API_VERSION.equals(n.path("api_version").asText())
                ||n.hasNonNull("account")||n.hasNonNull("context"))throw invalid();
            String event=n.path("id").asText(""),type=n.path("type").asText("");
            if(!event.matches("evt_[A-Za-z0-9]{4,80}")||type.isEmpty()||type.length()>100)throw invalid();
            if(!TYPES.contains(type))return;
            var resource=n.path("data").path("object");if(!resource.isObject())throw invalid();
            String customer=resource.path("customer").isTextual()?resource.path("customer").textValue():null;
            String charge=resource.path("charge").isTextual()?resource.path("charge").textValue():null;
            if(customer!=null&&!customer.matches("cus_[A-Za-z0-9]{4,80}")||charge!=null&&!charge.matches("ch_[A-Za-z0-9]{4,80}"))throw invalid();
            Long owner=store.owner(customer,charge);if(owner==null)return;
            store.event(owner,event,type,MessageDigest.getInstance("SHA-256").digest(body));
        }catch(BillingError known){throw known;}catch(com.fasterxml.jackson.core.JsonProcessingException ignored){throw invalid();}
        catch(Exception ignored){throw BillingError.unavailable();}
    }
    /** At most eight active readers, no queue, fixed read deadline; timed-out readers retain their permit until closed. */
    private byte[] readBody(InputStream stream){
        if(!readers.tryAcquire())throw BillingError.unavailable();
        var result=new java.util.concurrent.CompletableFuture<byte[]>();
        var worker=Thread.ofVirtual().name("stripe-webhook-body").start(()->{
            try(var input=stream){result.complete(input.readNBytes(262145));}
            catch(Exception ignored){result.completeExceptionally(new IllegalStateException("Webhook body unavailable"));}
            finally{readers.release();}
        });
        try{return result.get(3,java.util.concurrent.TimeUnit.SECONDS);}
        catch(InterruptedException ignored){Thread.currentThread().interrupt();worker.interrupt();throw BillingError.unavailable();}
        catch(Exception ignored){worker.interrupt();Thread.ofVirtual().start(()->{try{stream.close();}catch(Exception unavailable){/* No payload in logs. */}});throw BillingError.unavailable();}
    }
    static BillingError invalid(){return new BillingError("billing_webhook_invalid");}
    public static void verify(byte[] body,String signature,String secret,long now){
        try{
            if(signature==null||signature.length()>4096)throw invalid();
            String timestamp=null;var candidates=new ArrayList<byte[]>();
            for(String part:signature.split(",")){
                String[] pair=part.trim().split("=",2);if(pair.length!=2)throw invalid();
                if(pair[0].equals("t")){if(timestamp!=null||!pair[1].matches("[0-9]{1,12}"))throw invalid();timestamp=pair[1];}
                if(pair[0].equals("v1")){if(!pair[1].matches("[a-f0-9]{64}")||candidates.size()>=8)throw invalid();candidates.add(HexFormat.of().parseHex(pair[1]));}
            }
            if(timestamp==null||Math.abs(now-Long.parseLong(timestamp))>300||candidates.isEmpty())throw invalid();
            Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
            mac.update((timestamp+".").getBytes(StandardCharsets.US_ASCII));byte[] expected=mac.doFinal(body);
            boolean valid=false;for(var candidate:candidates)valid|=MessageDigest.isEqual(expected,candidate);
            if(!valid)throw invalid();
        }catch(BillingError known){throw known;}catch(Exception ignored){throw invalid();}
    }
}
