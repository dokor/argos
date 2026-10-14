package com.dokor.argos.webservices.api.account;

import com.dokor.argos.db.dao.AccountOverviewDao;
import com.dokor.argos.services.connected.summary.AccountOverviewService;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.util.Set;

@Path("/account")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
public final class AccountOverviewWs {
    private final AccountOverviewService service;

    @Inject
    public AccountOverviewWs(AccountOverviewService service) {
        this.service = service;
    }

    private static AccountOverviewDao.Filter filter(
            UriInfo uri, int limit, long offset, Long domain) {
        DomainSummariesWs.query(uri, Set.of("attention", "query", "domainId", "limit", "offset"));
        return new AccountOverviewDao.Filter(
                uri.getQueryParameters().getFirst("attention"),
                uri.getQueryParameters().getFirst("query"),
                domain,
                limit,
                offset);
    }

    @GET
    @Path("overview")
    public Response overview(
            @HeaderParam("Authorization") String auth,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("offset") @DefaultValue("0") long offset,
            @QueryParam("domainId") Long domain,
            @Context UriInfo uri) {
        return DomainBatchesWs.response(
                service.overview(auth, filter(uri, limit, offset, domain)), 200);
    }

    @GET
    @Path("pages")
    public Response pages(
            @HeaderParam("Authorization") String auth,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("offset") @DefaultValue("0") long offset,
            @QueryParam("domainId") Long domain,
            @Context UriInfo uri) {
        return DomainBatchesWs.response(
                service.pages(auth, filter(uri, limit, offset, domain)), 200);
    }
}
