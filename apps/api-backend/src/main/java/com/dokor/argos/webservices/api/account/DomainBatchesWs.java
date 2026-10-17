package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.analytics.AccountJourneyService;
import com.dokor.argos.services.analytics.AccountJourneyEvent;
import com.dokor.argos.services.connected.batch.BatchService;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/domain-batches")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public final class DomainBatchesWs {
    private final BatchService service;
    private final AccountCsrf csrf;
    private final AccountJourneyService journey;
    @Context private Provider<ContainerRequestContext> requests;

    @Inject
    public DomainBatchesWs(BatchService service, AccountCsrf csrf, AccountJourneyService journey) {
        this.service = service;
        this.csrf = csrf;
        this.journey = journey;
    }

    static Response response(Object body, int status) {
        return Response.status(status)
                .header("Cache-Control", "private, no-store")
                .entity(body)
                .build();
    }

    @POST
    public Response create(
            @HeaderParam("Authorization") String auth,
            @HeaderParam("Idempotency-Key") String key,
            CreateBatch input) {
        var result = service.createObserved(auth, csrf.require(requests.get()), key, input);
        if (result.created()) journey.record(AccountJourneyEvent.ACTIVATED, result.ownerId(), result.ownerId(),
                "none", requests.get().getHeaderString("Accept-Language"), requests.get().getHeaderString("X-Argos-Measurement"));
        return response(result.admitted(), 202);
    }

    @GET
    public Response active(@HeaderParam("Authorization") String auth) {
        return response(service.active(auth), 200);
    }
}
