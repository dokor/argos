package com.dokor.argos.webservices.api.account;
import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.CiErrorCode;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;
import java.util.List;

/** @PublicApi bypasses browser-session permissions; CiKeyFilter authenticates every machine request. */
@Path("/ci/v1/identity") @PublicApi @Produces(MediaType.APPLICATION_JSON)
public class CiIdentityWs {
    public record Identity(int apiVersion,String integrationId,String keyId,List<String> scopes,List<String> origins) {}
    @GET public Response get(@Context ContainerRequestContext request) {
        var value=request.getProperty(CiKeysService.Context.class.getName());
        if(!(value instanceof CiKeysService.Context identity)) throw CiAccountOperations.fail(CiErrorCode.AUTHENTICATION_FAILED);
        if(!request.getUriInfo().getQueryParameters().isEmpty()) throw CiAccountOperations.fail(CiErrorCode.CONFIG_INVALID);
        return AccountAuthWs.ok(new Identity(1,identity.integrationPublicId(),identity.keyId(),identity.scopes().stream().sorted().toList(),
            identity.targets().stream().map(CiTargetsService.Grant::origin).toList()));
    }
}
