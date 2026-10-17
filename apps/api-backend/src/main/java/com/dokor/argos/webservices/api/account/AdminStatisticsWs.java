package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AdminStatisticsService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;
import java.util.Set;

@Path("/account/admin/statistics")
@AccountAccess("admin")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
public class AdminStatisticsWs {
    private final AdminStatisticsService statistics;
    @Context private Provider<ContainerRequestContext> requests;
    @Context private UriInfo uri;

    @Inject public AdminStatisticsWs(AdminStatisticsService statistics) { this.statistics=statistics; }

    @GET public Response read(@QueryParam("period") @DefaultValue("all") String period) {
        DomainSummariesWs.query(uri,Set.of("period"));
        return AccountAuthWs.ok(statistics.read(requests.get().getHeaderString("Authorization"),period));
    }
}
