package com.dokor.argos.webservices.api.audits;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.audit.AuditService;
import com.dokor.argos.services.domain.audit.AuditQueryService;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.dokor.argos.services.domain.report.ReportReadService;
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
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Endpoints REST pour la gestion des audits.
 * <p>
 * Creation is public; every read requires the BFF's server credential.
 */
@Path("/audits")
@Tag(name = "audits", description = "Manage audits")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi // Per-method admin checks below; POST remains public.
@Singleton
public class AuditsWs {

    private static final Logger logger = LoggerFactory.getLogger(AuditsWs.class);

    private final AuditService auditService;
    private final AuditQueryService auditQueryService;
    private final AdminReadAccess adminReadAccess;
    private final ReportReadService reportReadService;

    @Inject
    public AuditsWs(AuditService auditService, AuditQueryService auditQueryService,
                    AdminReadAccess adminReadAccess, ReportReadService reportReadService) {
        this.auditService = auditService;
        this.auditQueryService = auditQueryService;
        this.adminReadAccess = adminReadAccess;
        this.reportReadService = reportReadService;
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
            return Response.ok(AuditResponseMapper.created(auditService.createAudit(request.url()))).build();
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
    public Response getRunStatus(
        @Parameter(required = true) @PathParam("runId") Long runId,
        @HeaderParam("Authorization") String authorization
    ) {
        adminReadAccess.require(authorization);
        logger.debug("Get run status requested: runId={}", runId);
        return privateRead(AuditResponseMapper.status(auditQueryService.getRunStatus(runId)));
    }

    /**
     * Liste les audits avec leur dernier run.
     *
     * @param limit nombre maximum de résultats (entre 1 et 200, défaut 50)
     */
    @GET
    @Operation(description = "Liste des audits et dernier run associé")
    public Response listAudits(
        @QueryParam("limit") @DefaultValue("50") int limit,
        @HeaderParam("Authorization") String authorization
    ) {
        adminReadAccess.require(authorization);
        int safeLimit = Math.max(1, Math.min(limit, 200));
        logger.info("List audits limit={}", safeLimit);
        return privateRead(auditQueryService.listAudits(safeLimit).stream()
            .map(AuditResponseMapper::overview).toList());
    }

    /**
     * Historique des analyses d'un audit (une URL) : runs passés triés du plus
     * récent au plus ancien, avec lien de rapport et score global.
     *
     * @param auditId identifiant de l'audit
     * @param limit   nombre max de runs (entre 1 et 100, défaut 20)
     */
    @GET
    @Path("/{auditId}/history")
    @Operation(description = "Historique des analyses (runs) d'un audit")
    public Response getAuditHistory(
        @Parameter(required = true) @PathParam("auditId") Long auditId,
        @QueryParam("limit") @DefaultValue("20") int limit,
        @HeaderParam("Authorization") String authorization
    ) {
        adminReadAccess.require(authorization);
        int safeLimit = Math.max(1, Math.min(limit, 100));
        logger.info("Get audit history auditId={} limit={}", auditId, safeLimit);
        return privateRead(auditQueryService.getAuditHistory(auditId, safeLimit).stream()
            .map(AuditResponseMapper::history).toList());
    }

    private Response privateRead(Object body) {
        return Response.ok(body).header("Cache-Control", "private, no-store").build();
    }

    @GET
    @Path("/runs/{runId}/report")
    public Response getAdminReport(@PathParam("runId") long runId, @HeaderParam("Authorization") String authorization) {
        adminReadAccess.require(authorization);
        return reportReadService.getByRunId(runId).map(this::privateRead)
            .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).header("Cache-Control", "no-store").build());
    }
}
