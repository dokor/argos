package com.dokor.argos.webservices.api.account;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.billing.*;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Response;
import java.io.InputStream;

/** Intentionally public delivery endpoint; Stripe HMAC is its only authentication mechanism. */
@Path("/billing/stripe/webhook") @PublicApi @Singleton
public final class StripeWebhookWs {
    private final StripeWebhookService webhooks;
    @Inject public StripeWebhookWs(StripeWebhookService webhooks){this.webhooks=webhooks;}
    @POST public Response post(InputStream body,@HeaderParam("Stripe-Signature") String signature,
        @HeaderParam("Content-Type")String contentType,@HeaderParam("Content-Encoding")String encoding){
        webhooks.accept(body,signature,contentType,encoding);
        return Response.noContent().header("Cache-Control","private, no-store").header("X-Content-Type-Options","nosniff").build();
    }
}
