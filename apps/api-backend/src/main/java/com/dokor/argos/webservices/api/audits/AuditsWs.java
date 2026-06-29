package com.dokor.argos.webservices.api.audits;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.audit.AuditService;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.dokor.argos.webservices.api.audits.data.AuditListItemResponse;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
import com.dokor.argos.webservices.api.audits.data.CreateAuditRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

/**
 * Endpoints REST pour la gestion des audits.
 * <p>
 * TODO: sécuriser avec OAuth/JWT (actuellement @PublicApi).
 */
@Path("/audits")
@Tag(name = "audits", description = "Manage audits")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi // todo: passer en privée avec oAuth
@Singleton
public class AuditsWs {

    private static final Logger logger = LoggerFactory.getLogger(AuditsWs.class);

    private final AuditService auditService;

    @Inject
    public AuditsWs(AuditService auditService) {
        this.auditService = auditService;
    }

    /**
     * Crée un audit et un run associé en statut QUEUED.
     * <p>
     * La création est idempotente sur l'URL normalisée :
     * deux soumissions de la même URL créent deux runs distincts
     * mais partagent le même objet Audit en base.
     *
     * @return 200 avec le run créé, ou 400 si l'URL est absente/invalide
     */
    @POST
    @Operation(description = "Crée un audit (idempotent sur normalizedUrl) et crée un run en status QUEUED.")
    public Response createAudit(
        @Parameter(required = true) @RequestBody(required = true) @Valid CreateAuditRequest request
    ) {
        if (request == null || request.url() == null || request.url().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", "Field 'url' is required"))
                .build();
        }

        // Sanitize URL before logging to prevent log injection (CRLF, JNDI lookup strings, etc.)
        logger.info("Create audit requested: url={}", sanitizeForLog(request.url()));

        try {
            return Response.ok(auditService.createAudit(request)).build();
        } catch (IllegalArgumentException e) {
            logger.warn("Invalid URL submitted url={} error={}", sanitizeForLog(request.url()), e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", e.getMessage()))
                .build();
        }
    }

    /** Délègue à {@link UrlNormalizer#sanitizeForLog} pour éviter la duplication. */
    private static String sanitizeForLog(String url) {
        return UrlNormalizer.sanitizeForLog(url);
    }

    /**
     * Récupère le statut courant d'un run (polling client).
     *
     * @param runId identifiant du run
     */
    @GET
    @Path("/runs/{runId}")
    @Operation(description = "Récupère le statut d'un run.")
    public AuditRunStatusResponse getRunStatus(
        @Parameter(required = true) @PathParam("runId") Long runId
    ) {
        logger.debug("Get run status requested: runId={}", runId);
        return auditService.getRunStatus(runId);
    }

    /**
     * Liste les audits avec leur dernier run.
     *
     * @param limit nombre maximum de résultats (entre 1 et 200, défaut 50)
     */
    @GET
    @Operation(description = "Liste des audits et dernier run associé")
    public List<AuditListItemResponse> listAudits(
        @QueryParam("limit") @DefaultValue("50") int limit
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        logger.info("List audits limit={}", safeLimit);
        return auditService.listAudits(safeLimit);
    }
}
