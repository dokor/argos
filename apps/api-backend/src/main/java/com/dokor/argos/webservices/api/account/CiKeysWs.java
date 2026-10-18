package com.dokor.argos.webservices.api.account;
import com.dokor.argos.services.account.AccountCsrf;
import com.dokor.argos.services.ci.CiKeysService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/ci/keys") @AccountAccess("verified") @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class CiKeysWs {
    private final CiKeysService keys;private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> requests;
    @Context private Provider<org.glassfish.grizzly.http.server.Request> nativeRequests;
    @Inject public CiKeysWs(CiKeysService keys,AccountCsrf csrf){this.keys=keys;this.csrf=csrf;}
    private String auth(){return requests.get().getHeaderString("Authorization");}
    private String remote(){return AccountAuthWs.remote(nativeRequests.get());}
    @GET public Response list(@QueryParam("after") @DefaultValue("0") long after){return AccountAuthWs.ok(keys.list(auth(),after));}
    @POST public Response create(CiKeysService.Input input){return AccountAuthWs.ok(keys.create(auth(),csrf.require(requests.get()),input,remote()));}
    @POST @Path("/{id}/rotate") public Response rotate(@PathParam("id") String id){return AccountAuthWs.ok(keys.rotate(auth(),csrf.require(requests.get()),id,remote()));}
    @DELETE @Path("/{id}") public Response revoke(@PathParam("id") String id){return AccountAuthWs.ok(keys.revoke(auth(),csrf.require(requests.get()),id,remote()));}
}
