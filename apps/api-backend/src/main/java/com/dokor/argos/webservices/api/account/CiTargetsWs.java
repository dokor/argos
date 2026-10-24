package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountCsrf;
import com.dokor.argos.services.ci.*;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/ci/targets") @AccountAccess("verified") @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class CiTargetsWs {
    public record Input(String origin) {}
    private final CiTargetsService targets;
    private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> requests;
    @Context private Provider<org.glassfish.grizzly.http.server.Request> nativeRequests;
    @Inject public CiTargetsWs(CiTargetsService targets,AccountCsrf csrf) { this.targets=targets; this.csrf=csrf; }
    private String auth() { return requests.get().getHeaderString("Authorization"); }
    private String remote() { return AccountAuthWs.remote(nativeRequests.get()); }
    @GET public Response list(@QueryParam("after") @DefaultValue("0") long after) { return AccountAuthWs.ok(targets.list(auth(),after)); }
    @POST public Response create(Input body) { return AccountAuthWs.ok(targets.create(auth(),csrf.require(requests.get()),body==null?null:body.origin(),remote())); }
    @POST @Path("/{id}/renew") public Response renew(@PathParam("id") String id) { return AccountAuthWs.ok(targets.renew(auth(),csrf.require(requests.get()),id,remote())); }
    @POST @Path("/{id}/verify") public Response verify(@PathParam("id") String id) { return AccountAuthWs.ok(targets.verify(auth(),csrf.require(requests.get()),id,remote())); }
    @DELETE @Path("/{id}") public Response revoke(@PathParam("id") String id) { return AccountAuthWs.ok(targets.revoke(auth(),csrf.require(requests.get()),id,remote())); }
}
