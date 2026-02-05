package com.dokor.argos.webservices.api.audits;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.webservices.api.audits.data.CreateAuditRequest;
import com.dokor.argos.webservices.api.audits.data.CreateAuditResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

@Path("/audits")
@Tag(name = "audits", description = "Manage audits")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi // todo: passer en privée avec oAuth
@Singleton
public class AuditsWs {

    private static final Logger logger = LoggerFactory.getLogger(AuditsWs.class);

//    private final AuditService auditService;

    @Inject
    public AuditsWs(
//        AuditService auditService
    ) {
//        this.auditService = auditService;
    }

    @POST
    @Operation(description = "Crée un audit (idempotent sur normalizedUrl) et crée un run en status QUEUED.")
    public CreateAuditResponse createAudit(
        @Parameter(required = true) @RequestBody(required = true) CreateAuditRequest request
    ) {
        logger.info("Create audit requested: url={}", request.url());
//        return auditService.createAudit(request);
        return new CreateAuditResponse(1L, 1L, "", Instant.now());
    }

//    @GET
//    @Path("/runs/{runId}")
//    @Operation(description = "Récupère le statut d'un run.")
//    public AuditRunStatusResponse getRunStatus(
//        @Parameter(required = true) @PathParam("runId") long runId
//    ) {
//        logger.debug("Get run status requested: runId={}", runId);
//        return auditService.getRunStatus(runId);
//    }
}
