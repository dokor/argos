package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.statistics.ProblemStatisticsService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.Set;

@Path("/account/admin/problem-statistics") @AccountAccess("admin") @Singleton
@Produces(MediaType.APPLICATION_JSON)
public class ProblemStatisticsWs {
    private final ProblemStatisticsService statistics;
    @Inject public ProblemStatisticsWs(ProblemStatisticsService statistics) { this.statistics=statistics; }

    @GET public Response read(@HeaderParam("Authorization") String authorization,
        @QueryParam("days") @DefaultValue("90") int days, @QueryParam("category") String category, @Context UriInfo uri) {
        var params=uri.getQueryParameters();
        if (params.keySet().stream().anyMatch(key -> !Set.of("days","category").contains(key))
            || params.values().stream().anyMatch(values -> values.size()!=1)) throw new AccountError(400,"filter_invalid");
        return AccountAuthWs.ok(statistics.read(authorization,days,category));
    }
}
