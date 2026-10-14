package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountCsrf;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.connected.discovery.DiscoveryService;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/domain-discoveries")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public final class DomainDiscoveriesWs {
    private final DiscoveryService service;
    private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> requests;

    @Inject
    public DomainDiscoveriesWs(DiscoveryService service, AccountCsrf csrf) {
        this.service = service;
        this.csrf = csrf;
    }

    private Response response(Object body, int status) {
        return Response.status(status)
                .header("Cache-Control", "private, no-store")
                .entity(body)
                .build();
    }

    @POST
    public Response create(
            @HeaderParam("Authorization") String auth,
            @HeaderParam("Idempotency-Key") String key,
            CreateDiscovery input) {
        return response(service.create(auth, csrf.require(requests.get()), key, input), 202);
    }

    @GET
    public Response active(@HeaderParam("Authorization") String auth) {
        return response(service.active(auth), 200);
    }

    @GET
    @Path("{id}")
    public Response get(@HeaderParam("Authorization") String auth, @PathParam("id") long id) {
        return response(service.get(auth, id), 200);
    }

    @GET
    @Path("{id}/pages")
    public Response pages(
            @HeaderParam("Authorization") String auth,
            @PathParam("id") long id,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("offset") @DefaultValue("0") long offset,
            @QueryParam("inclusion") @DefaultValue("all") String inclusion) {
        return response(service.pages(auth, id, limit, offset, inclusion), 200);
    }

    @POST
    @Path("{id}/cancel")
    public Response cancel(
            @HeaderParam("Authorization") String auth,
            @PathParam("id") long id,
            java.util.Map<String, Object> body) {
        if (body != null && !body.isEmpty())
            throw new com.dokor.argos.services.account.AccountError(400, "payload_invalid");
        var row = service.cancel(auth, csrf.require(requests.get()), id);
        return response(row, row.status() == ExecutionStatus.RUNNING ? 202 : 200);
    }
}
