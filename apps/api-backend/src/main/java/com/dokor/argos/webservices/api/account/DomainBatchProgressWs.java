package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.batch.BatchService;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/domains/{domainId}/batches/{id}")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public final class DomainBatchProgressWs {
    private final BatchService service;
    private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> requests;

    @Inject
    public DomainBatchProgressWs(BatchService service, AccountCsrf csrf) {
        this.service = service;
        this.csrf = csrf;
    }

    @GET
    @Path("progress")
    public Response get(
            @HeaderParam("Authorization") String auth,
            @PathParam("domainId") long domain,
            @PathParam("id") long id) {
        return DomainBatchesWs.response(service.get(auth, domain, id), 200);
    }

    @GET
    @Path("progress/pages")
    public Response pages(
            @HeaderParam("Authorization") String auth,
            @PathParam("domainId") long domain,
            @PathParam("id") long id,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("offset") @DefaultValue("0") long offset,
            @QueryParam("status") @DefaultValue("all") String status) {
        return DomainBatchesWs.response(
                service.pages(auth, domain, id, limit, offset, status), 200);
    }

    @POST
    @Path("cancel")
    public Response cancel(
            @HeaderParam("Authorization") String auth,
            @PathParam("domainId") long domain,
            @PathParam("id") long id,
            java.util.Map<String, Object> body) {
        if (body != null && !body.isEmpty()) throw new AccountError(400, "payload_invalid");
        var result = service.cancel(auth, csrf.require(requests.get()), domain, id);
        return DomainBatchesWs.response(
                result,
                result.status() == BatchStatus.QUEUED || result.status() == BatchStatus.RUNNING
                        ? 202
                        : 200);
    }
}
