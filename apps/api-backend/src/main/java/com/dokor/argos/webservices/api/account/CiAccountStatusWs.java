package com.dokor.argos.webservices.api.account;
import com.dokor.argos.services.ci.CiAccountStatusService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/ci/status") @AccountAccess("verified") @Singleton @Produces(MediaType.APPLICATION_JSON)
public class CiAccountStatusWs {
    private final CiAccountStatusService status;
    @Context private Provider<ContainerRequestContext> requests;
    @Inject public CiAccountStatusWs(CiAccountStatusService status){this.status=status;}
    @GET public Response get(){
        if(!requests.get().getUriInfo().getQueryParameters().isEmpty())throw com.dokor.argos.services.ci.CiAccountOperations.fail(com.dokor.argos.services.ci.errors.CiErrorCode.CONFIG_INVALID);
        return AccountAuthWs.ok(status.read(requests.get().getHeaderString("Authorization")));
    }
}
