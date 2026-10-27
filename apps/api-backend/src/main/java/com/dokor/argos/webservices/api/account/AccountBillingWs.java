package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountCsrf;
import com.dokor.argos.services.billing.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/billing") @AccountAccess("verified") @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public final class AccountBillingWs {
    private final BillingService billing;private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> request;
    @Context private Provider<org.glassfish.grizzly.http.server.Request> nativeRequest;
    @Inject public AccountBillingWs(BillingService billing,AccountCsrf csrf){this.billing=billing;this.csrf=csrf;}
    private String auth(){return request.get().getHeaderString("Authorization");}
    private void noQuery(){if(!request.get().getUriInfo().getQueryParameters().isEmpty())throw new BillingError("billing_request_invalid");}
    private String lang(){return "en".equals(request.get().getHeaderString("Accept-Language"))?"en":"fr";}
    private String remote(){return nativeRequest.get().getRemoteAddr();}
    private void empty(JsonNode body){noQuery();if(body==null||!body.isObject()||!body.isEmpty())throw new BillingError("billing_request_invalid");}
    @GET public Response get(){noQuery();return AccountAuthWs.ok(billing.status(auth()));}
    @POST @Path("/checkout") public Response checkout(JsonNode body){
        noQuery();if(body==null||!body.isObject()||body.size()!=1||!body.path("interval").isTextual())throw new BillingError("billing_request_invalid");
        return AccountAuthWs.ok(billing.checkout(auth(),csrf.require(request.get()),body.path("interval").asText(),lang(),remote()));
    }
    @POST @Path("/portal") public Response portal(JsonNode body){empty(body);return AccountAuthWs.ok(billing.portal(auth(),csrf.require(request.get()),lang(),remote()));}
    @POST @Path("/sync") public Response sync(JsonNode body){empty(body);billing.sync(auth(),csrf.require(request.get()),remote());return AccountAuthWs.ok(billing.status(auth()));}
}
