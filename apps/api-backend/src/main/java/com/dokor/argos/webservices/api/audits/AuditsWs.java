package com.dokor.argos.webservices.api.audits;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.AuditService;
import com.dokor.argos.services.domain.enums.AuditRunStatus;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
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

import java.time.LocalDateTime;

@Path("/audits")
@Tag(name = "audits", description = "Manage audits")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi // passer en privée avec oAuth
@Singleton
public class AuditsWs {

    private static final Logger logger = LoggerFactory.getLogger(AuditsWs.class);
    private final AuditService auditService;

    @Inject
    public AuditsWs(
        AuditService auditService
    ) {
        this.auditService = auditService;
    }

    @POST
    @Operation(description = "creation d'un audit")
    public CreateAuditResponse createAudit(@Parameter(required = true) @RequestBody CreateAuditRequest createAuditRequest) {
        logger.debug("Demande de création de l'audit de [{}]", createAuditRequest);
        return this.auditService.createAuditOfUrl(createAuditRequest.url());
    }

    @GET
    @Path("/runs/{runId}")
    @Operation(description = "Récupération d'un audit en cours")
    public AuditRunStatusResponse getRunStatus(@Parameter(required = true) @PathParam("runId") String runId) {
        logger.debug("Demande de récupération de l'audit [{}]", runId);
        return this.auditService.getRunStatusOfId(runId);
    }
}
