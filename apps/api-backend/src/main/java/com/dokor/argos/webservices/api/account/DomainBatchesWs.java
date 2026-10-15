package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
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
    @Context private Provider<ContainerRequestContext> requests;

    @Inject
    public DomainBatchesWs(BatchService service, AccountCsrf csrf) {
        this.service = service;
        this.csrf = csrf;
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
        return response(service.create(auth, csrf.require(requests.get()), key, input), 202);
    }

    @GET
    public Response active(@HeaderParam("Authorization") String auth) {
        return response(service.active(auth), 200);
    }
}
