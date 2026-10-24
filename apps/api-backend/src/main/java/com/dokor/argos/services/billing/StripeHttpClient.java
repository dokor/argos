package com.dokor.argos.services.billing;

import com.fasterxml.jackson.databind.*;
import jakarta.inject.*;
import java.net.*;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.Flow;

/** JSON byte limit is enforced during streaming, with a deadline covering the whole body. */
@Singleton
public final class StripeHttpClient implements StripeGateway {
    private final BillingSettings settings;private final ObjectMapper mapper;
    private final java.util.concurrent.Semaphore capacity=new java.util.concurrent.Semaphore(8);
    private final HttpClient http=HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).connectTimeout(Duration.ofSeconds(3)).build();
    @Inject public StripeHttpClient(BillingSettings settings,ObjectMapper mapper){this.settings=settings;this.mapper=mapper;}
    public JsonNode get(String path,Map<String,String> query){return request("GET",path,query,null);}
    public JsonNode post(String path,Map<String,String> form,String key){return request("POST",path,form,key);}
    private static String encode(Map<String,String> values){return values.entrySet().stream().sorted(Map.Entry.comparingByKey())
        .map(e->URLEncoder.encode(e.getKey(),StandardCharsets.UTF_8)+"="+URLEncoder.encode(e.getValue(),StandardCharsets.UTF_8))
        .collect(java.util.stream.Collectors.joining("&"));}
    private JsonNode request(String method,String path,Map<String,String> values,String key){
        settings.requireEnabled();
        if(!path.matches("/v1/[a-z_]+(?:/[A-Za-z0-9_]+){0,2}")||path.length()>240)throw new BillingError("billing_configuration");
        String encoded=encode(values),url="https://api.stripe.com"+path+(method.equals("GET")&&!encoded.isEmpty()?"?"+encoded:"");
        var b=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8))
            .header("Authorization","Bearer "+settings.key()).header("Stripe-Version",BillingSettings.API_VERSION).header("Accept","application/json");
        if(method.equals("POST")){
            if(key==null||!key.matches("[A-Za-z0-9_-]{16,128}"))throw new BillingError("billing_configuration");
            b.header("Idempotency-Key",key).header("Content-Type","application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(encoded,StandardCharsets.UTF_8));
        }
        CompletableFuture<HttpResponse<byte[]>> future=null;
        if(!capacity.tryAcquire())throw BillingError.unavailable();
        try{
            future=http.sendAsync(b.build(),info->new LimitedBody(524288));
            var r=future.get(8,TimeUnit.SECONDS);
            if(r.statusCode()!=200||!r.headers().firstValue("Content-Type").orElse("").matches("(?i)application/json(?:;\\s*charset=utf-8)?"))
                throw BillingError.unavailable();
            var decoder=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT);
            var node=mapper.readTree(decoder.decode(ByteBuffer.wrap(r.body())).toString());
            if(node==null||!node.isObject())throw BillingError.unavailable();
            return node;
        }catch(InterruptedException e){Thread.currentThread().interrupt();throw BillingError.unavailable();}
        catch(Exception e){throw BillingError.unavailable();}
        finally{if(future!=null&&!future.isDone())future.cancel(true);capacity.release();}
    }
    static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final int max;private final java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
        private final CompletableFuture<byte[]> result=new CompletableFuture<>();private Flow.Subscription subscription;
        LimitedBody(int max){this.max=max;}
        public CompletionStage<byte[]> getBody(){return result;}
        public void onSubscribe(Flow.Subscription s){subscription=s;s.request(1);}
        public void onNext(List<ByteBuffer> items){for(var part:items){if(part.remaining()>max-bytes.size()){subscription.cancel();result.completeExceptionally(new IllegalStateException("Billing response limit"));return;}
            byte[] chunk=new byte[part.remaining()];part.get(chunk);bytes.writeBytes(chunk);}subscription.request(1);}
        public void onError(Throwable failed){result.completeExceptionally(new IllegalStateException("Billing transport failed"));}
        public void onComplete(){result.complete(bytes.toByteArray());}
    }
}
