package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.UsageTimelineService;
import com.dokor.argos.services.account.AccountError;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.List;
import java.util.Set;

@Path("/account/usage/timeline")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
public final class UsageTimelineWs {
    private final UsageTimelineService service;
    @Inject public UsageTimelineWs(UsageTimelineService service) { this.service = service; }

    @GET public Response timeline(@HeaderParam("Authorization") String auth,
            @QueryParam("granularity") @DefaultValue("DAY") String granularity,
            @QueryParam("dimension") @DefaultValue("GLOBAL") String dimension,
            @QueryParam("from") String from, @QueryParam("until") String until,
            @QueryParam("filter") List<String> filters, @QueryParam("q") String search, @Context UriInfo uri) {
        var params = uri.getQueryParameters();
        if (params.entrySet().stream().anyMatch(entry -> !Set.of("granularity", "dimension", "from", "until", "filter", "q").contains(entry.getKey())
                || !entry.getKey().equals("filter") && entry.getValue().size() != 1)) throw new AccountError(400, "filter_invalid");
        return AccountAuthWs.ok(service.timeline(auth, granularity, dimension, from, until, filters, search));
    }
}
