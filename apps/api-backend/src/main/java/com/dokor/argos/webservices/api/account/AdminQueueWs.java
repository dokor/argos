package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.Set;

@Path("/account/admin/queue/tasks")
@AccountAccess("admin")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
public final class AdminQueueWs {
    private final AdminQueueService queue;
    @Context private UriInfo uri;
    @Inject public AdminQueueWs(AdminQueueService queue) { this.queue = queue; }

    @GET
    public Response list(@HeaderParam("Authorization") String auth,
            @QueryParam("type") String type, @QueryParam("status") String status,
            @QueryParam("site") String site, @QueryParam("user") String user,
            @QueryParam("from") String from, @QueryParam("until") String until,
            @QueryParam("sort") String sort, @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("limit") @DefaultValue("20") int limit) {
        DomainSummariesWs.query(uri, Set.of("type", "status", "site", "user", "from", "until", "sort", "page", "limit"));
        return AccountAuthWs.ok(queue.list(auth, new AdminQueueService.Filters(type, status, site, user, from, until, sort, page, limit)));
    }

    @GET @Path("/{type}/{id}")
    public Response detail(@HeaderParam("Authorization") String auth, @PathParam("type") String type, @PathParam("id") String id) {
        DomainSummariesWs.query(uri, Set.of());
        return AccountAuthWs.ok(queue.detail(auth, type, AdminService.id(id)));
    }
}
