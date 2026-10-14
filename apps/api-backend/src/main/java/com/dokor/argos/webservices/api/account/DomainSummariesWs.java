package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.summary.*;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.util.*;

@Path("/account/domains")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
public final class DomainSummariesWs {
    private final DomainSummaryService service;

    @Inject
    public DomainSummariesWs(DomainSummaryService service) {
        this.service = service;
    }

    static void query(UriInfo uri, Set<String> allowed) {
        if (uri.getQueryParameters().entrySet().stream()
                .anyMatch(e -> !allowed.contains(e.getKey()) || e.getValue().size() != 1))
            throw new AccountError(400, "filter_invalid");
    }

    @GET
    public Response list(
            @HeaderParam("Authorization") String auth,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("offset") @DefaultValue("0") long offset,
            @Context UriInfo uri) {
        query(uri, Set.of("limit", "offset", "query"));
        return DomainBatchesWs.response(
                service.list(auth, limit, offset, uri.getQueryParameters().getFirst("query")), 200);
    }

    @GET
    @Path("{domainId}/batches")
    public Response history(
            @HeaderParam("Authorization") String auth,
            @PathParam("domainId") long domain,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("offset") @DefaultValue("0") long offset,
            @Context UriInfo uri) {
        query(uri, Set.of("limit", "offset"));
        return DomainBatchesWs.response(service.history(auth, domain, limit, offset), 200);
    }
}
