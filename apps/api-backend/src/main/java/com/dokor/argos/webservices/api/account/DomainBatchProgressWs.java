package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.batch.BatchService;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.dokor.argos.services.connected.summary.*;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

import java.util.Set;

@Path("/account/domains/{domainId}/batches/{id}")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public final class DomainBatchProgressWs {
    private final BatchService service;
    private final AccountCsrf csrf;
    private final DomainSummaryService summaries;
    @Context private Provider<ContainerRequestContext> requests;

    @Inject
    public DomainBatchProgressWs(
            BatchService service, AccountCsrf csrf, DomainSummaryService summaries) {
        this.service = service;
        this.csrf = csrf;
        this.summaries = summaries;
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

    @GET
    public Response summary(
            @HeaderParam("Authorization") String auth,
            @PathParam("domainId") long domain,
            @PathParam("id") long id,
            @Context UriInfo uri) {
        DomainSummariesWs.query(uri, Set.of());
        return DomainBatchesWs.response(summaries.summary(auth, domain, id), 200);
    }

    @GET
    @Path("pages")
    public Response pages(
            @HeaderParam("Authorization") String auth,
            @PathParam("domainId") long domain,
            @PathParam("id") long id,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("offset") @DefaultValue("0") long offset,
            @Context UriInfo uri) {
        DomainSummariesWs.query(
                uri,
                Set.of(
                        "limit",
                        "offset",
                        "ruleKey",
                        "definitionVersion",
                        "severity",
                        "status",
                        "query",
                        "sort",
                        "scope",
                        "completeness"));
        var q = uri.getQueryParameters();
        var filter =
                new DomainSummaryProjection.Filter(
                        q.getFirst("ruleKey"),
                        q.getFirst("definitionVersion"),
                        q.getFirst("severity"),
                        q.getFirst("status"),
                        q.getFirst("query"),
                        q.getFirst("sort"),
                        q.getFirst("scope"),
                        q.getFirst("completeness"));
        return DomainBatchesWs.response(
                summaries.pages(auth, domain, id, limit, offset, filter), 200);
    }
}
