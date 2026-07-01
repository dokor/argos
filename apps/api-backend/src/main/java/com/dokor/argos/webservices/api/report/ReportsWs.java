package com.dokor.argos.webservices.api.report;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.audit.model.ModuleStatus;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/reports")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi
@Singleton
public class ReportsWs {

    private static final Logger logger = LoggerFactory.getLogger(ReportsWs.class);
    private final ReportReadService reportReadService;
    private final AuditRunService auditRunService;

    @Inject
    public ReportsWs(ReportReadService reportReadService, AuditRunService auditRunService) {
        this.reportReadService = reportReadService;
        this.auditRunService = auditRunService;
    }

    @GET
    @Path("/{token}")
    public Response getReport(@PathParam("token") String token) {
        logger.debug("Get report token={}", token);
        var reportOpt = reportReadService.getByToken(token);
        if (reportOpt.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(reportOpt.get())
            .header("X-Robots-Tag", "noindex, nofollow")
            .header("Cache-Control", "private, no-store")
            .build();
    }

    /**
     * Retourne l'état courant d'un run via son reportToken pré-généré.
     * Disponible dès la création du run, avant même que le rapport soit publié.
     * Utilisé par la page rapport pour afficher la progression par module.
     */
    @GET
    @Path("/{token}/status")
    public Response getReportStatus(@PathParam("token") String token) {
        logger.debug("Get report status token={}", token);

        var runOpt = auditRunService.findByReportToken(token);
        if (runOpt.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        var run = runOpt.get();
        var statusResponse = new AuditRunStatusResponse(
            run.getId(),
            run.getAuditId(),
            run.getStatus(),
            run.getCreatedAt(),
            run.getStartedAt(),
            run.getFinishedAt(),
            run.getLastError(),
            null, // resultJson not exposed here (large payload)
            run.getReportToken(),
            run.getModuleStatuses()
        );

        return Response.ok(statusResponse)
            .header("Cache-Control", "no-cache, no-store")
            .build();
    }
}
