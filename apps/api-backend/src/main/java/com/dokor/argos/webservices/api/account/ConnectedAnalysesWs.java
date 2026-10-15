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
    @Context private Provider<ContainerRequestContext> requests;
    @Inject public ConnectedAnalysesWs(ConnectedAnalysesService analyses, AccountCsrf csrf) {
        this.analyses=analyses; this.csrf=csrf;
    }
    @POST public Response create(@HeaderParam("Authorization") String auth,
            @HeaderParam("Idempotency-Key") String key, com.dokor.argos.services.connected.contract.ConnectedContracts.SiteAnalysisInput input) {
        return AccountAuthWs.ok(analyses.create(auth,csrf.require(requests.get()),key,input));
    }
    @GET @Path("{key}") public Response get(@HeaderParam("Authorization") String auth, @PathParam("key") String key) {
        return AccountAuthWs.ok(analyses.get(auth,key));
    }
}
