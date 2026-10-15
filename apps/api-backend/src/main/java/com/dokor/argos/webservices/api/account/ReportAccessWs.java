package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.report.ReportSharingService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import jakarta.ws.rs.container.ContainerRequestContext;

@Path("/account") @AccountAccess("verified") @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class ReportAccessWs {
    public record ShareInput(int days) {}
    private final ReportSharingService sharing; private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> requests;
    @Inject public ReportAccessWs(ReportSharingService sharing,AccountCsrf csrf){this.sharing=sharing;this.csrf=csrf;}
    private String auth(){return requests.get().getHeaderString("Authorization");}
    @POST @Path("/runs/{id}/share") public Response share(@PathParam("id") long id,ShareInput input) {
        return AccountAuthWs.ok(sharing.create(auth(),csrf.require(requests.get()),id,input==null?30:input.days()));
    }
    @DELETE @Path("/runs/{id}/share") public Response revoke(@PathParam("id") long id) {
        sharing.revoke(auth(),csrf.require(requests.get()),id);return AccountAuthWs.ok(java.util.Map.of("revoked",true));
    }
    @GET @Path("/reports/{token}") public Response report(@PathParam("token") String token){return AccountAuthWs.ok(sharing.details(auth(),token,false));}
    @GET @Path("/shared-reports/{token}") public Response shared(@PathParam("token") String token){return AccountAuthWs.ok(sharing.details(auth(),token,true));}
}
