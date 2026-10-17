package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountCsrf;
import com.dokor.argos.services.connected.ConnectedAnalysesService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/analyses") @AccountAccess("verified") @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public final class ConnectedAnalysesWs {
    private final ConnectedAnalysesService analyses;
    private final AccountCsrf csrf;
    private final com.dokor.argos.services.analytics.ProductAnalyticsService analytics;
    @Context private Provider<ContainerRequestContext> requests;
    @Inject public ConnectedAnalysesWs(ConnectedAnalysesService analyses, AccountCsrf csrf, com.dokor.argos.services.analytics.ProductAnalyticsService analytics) {
        this.analyses=analyses; this.csrf=csrf; this.analytics=analytics;
    }
    @POST public Response create(@HeaderParam("Authorization") String auth,
            @HeaderParam("Idempotency-Key") String key, com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput input) {
        var result = analyses.createObserved(auth,csrf.require(requests.get()),key,input);
        if (result.created()) analytics.attribute(Long.parseLong(result.accepted().runId()),
            new com.dokor.argos.services.analytics.AnalyticsDimensions("/account/analyses/new",
                "en".equals(requests.get().getHeaderString("Accept-Language")) ? "en" : "fr", "form"),
            requests.get().getHeaderString("X-Argos-Measurement"));
        return AccountAuthWs.ok(result.accepted());
    }
    @GET @Path("{key}") public Response get(@HeaderParam("Authorization") String auth, @PathParam("key") String key) {
        return AccountAuthWs.ok(analyses.get(auth,key));
    }
}
