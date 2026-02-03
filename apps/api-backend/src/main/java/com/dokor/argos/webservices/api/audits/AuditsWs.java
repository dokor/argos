package com.dokor.argos.webservices.api.audits;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.webservices.api.data.Test;
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
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Path("/audits")
@Tag(name = "audits", description = "Manage audits")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi // passer en privée avec oAuth
@Singleton
public class AuditsWs {

    private final ConfigurationService configurationService;

    @Inject
    public AuditsWs(ConfigurationService configurationService) {
        this.configurationService = configurationService;
    }

    @POST
    @Path("/")
    @Operation(description = "creation d'un audit")
    public Test createAudit(@Parameter(required = true) @RequestBody String url) {
        logger.debug("Demande de création de l'audit de [{}]", url);
        return new Test("hello " + url + "\n" + configurationService.hello());
    }

    @GET
    @Path("/run/{runId}")
    @Operation(description = "Récupération d'un audit en cours")
    public Test getRunStatus(@Parameter(required = true) @PathParam("runId") String runId) {
        logger.debug("Demande de récupération de l'audit [{}]", runId);
        return new Test("hello " + runId + "\n" + configurationService.hello());
    }
}
