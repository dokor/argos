package com.dokor.argos.webservices.api.account;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.ci.*;
import com.dokor.argos.services.ci.errors.CiErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.*;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

/** Machine credentials only; @PublicApi does not grant access without the pre-matching filter. */
@Path("/ci/v1") @PublicApi @Singleton @Consumes(MediaType.APPLICATION_JSON) @Produces(MediaType.APPLICATION_JSON)
@SecurityScheme(name="argosCiApiKey",type=SecuritySchemeType.HTTP,scheme="bearer",bearerFormat="Argos CI API key")
@SecurityRequirement(name="argosCiApiKey")
public class CiAdmissionWs {
    private final CiAdmissionService ci;
    @Inject public CiAdmissionWs(CiAdmissionService ci){this.ci=ci;}
    private String auth(ContainerRequestContext request) {
        if(!(request.getProperty(CiKeysService.Context.class.getName()) instanceof CiKeysService.Context))throw CiAccountOperations.fail(CiErrorCode.AUTHENTICATION_FAILED);
        if(!request.getUriInfo().getQueryParameters().isEmpty())throw CiAccountOperations.fail(CiErrorCode.CONFIG_INVALID);
        return request.getHeaderString("Authorization");
    }
    private String peer(ContainerRequestContext request) {
        Object peer=request.getProperty(CiKeyFilter.PEER_PROPERTY);return peer instanceof String value?value:"direct";
    }
    private long runId(String value) {
        try {if(!value.matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException();return Long.parseLong(value);}
        catch(Exception invalid){throw CiAccountOperations.fail(CiErrorCode.CONFIG_INVALID);}
    }
    private Response ok(Object value){return Response.ok(value).header("Cache-Control","private, no-store").build();}
    @POST @Path("/analyses") @Operation(description="Admit one or two sequential full analyses atomically. Idempotency-Key UUID required; no public report token.")
    public Response create(@Context ContainerRequestContext request,@HeaderParam("Idempotency-Key") String key,JsonNode input) {
        String authorization=auth(request);
        var result=ci.create(authorization,peer(request),key,CiAdmissionService.input(input));
        return Response.status(result.created()?201:200).entity(result.admission()).header("Cache-Control","private, no-store").build();
    }
    @GET @Path("/admissions/by-key/{key}") @Operation(description="Recover the original intention after a lost response, without a new analysis or charge.")
    public Response byKey(@Context ContainerRequestContext request,@PathParam("key") String key){return ok(ci.byKey(auth(request),peer(request),key));}
    @GET @Path("/admissions/{id}") @Operation(description="Read this integration's admission and at most two run summaries.")
    public Response get(@Context ContainerRequestContext request,@PathParam("id") String id){return ok(ci.get(auth(request),peer(request),id));}
    @GET @Path("/runs/{id}") @Operation(description="Read authorized run progress without raw errors, credentials or evidence.")
    public Response run(@Context ContainerRequestContext request,@PathParam("id") String id){return ok(ci.run(auth(request),peer(request),runId(id)));}
    @GET @Path("/runs/{id}/report") @Operation(description="Read the private numeric summary-v1 report. Detailed exports and verdicts are separate contracts.")
    public Response report(@Context ContainerRequestContext request,@PathParam("id") String id){return ok(ci.report(auth(request),peer(request),runId(id)));}
    @GET @Path("/usage") @Operation(description="Read this stable integration's monthly ledger. No new admission.")
    public Response usage(@Context ContainerRequestContext request){return ok(ci.usage(auth(request),peer(request)));}
    @GET @Path("/preflight") @Operation(description="Read current rights, declared target states and usage; no DNS/proof verification, reservation or target contact.")
    public Response preflight(@Context ContainerRequestContext request){return ok(ci.preflight(auth(request),peer(request)));}
}
