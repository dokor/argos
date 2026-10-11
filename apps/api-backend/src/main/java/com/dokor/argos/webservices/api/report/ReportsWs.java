package com.dokor.argos.webservices.api.report;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.dokor.argos.webservices.api.audits.data.ReportStatusResponse;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
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
    private final com.dokor.argos.services.analytics.ProductAnalyticsService analytics;

    public ReportsWs(ReportReadService reports,AuditRunService runs){this(reports,runs,null);}
    @Inject
    public ReportsWs(ReportReadService reportReadService, AuditRunService auditRunService, com.dokor.argos.services.analytics.ProductAnalyticsService analytics) {
        this.reportReadService = reportReadService;
        this.auditRunService = auditRunService;
        this.analytics = analytics;
    }

    public Response getReport(String token){return getReport(token,null,null);}
    @GET
    @Path("/{token}")
    public Response getReport(@PathParam("token") String token,@HeaderParam("Authorization") String authorization,@HeaderParam("X-Product-Consent") String consent) {
        var reportOpt = reportReadService.getByToken(token);
        if (reportOpt.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if(analytics!=null) analytics.viewed(token,authorization,consent);
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

        var runOpt = auditRunService.findByReportToken(token);
        if (runOpt.isEmpty() || reportReadService.isExpired(runOpt.get().getId())) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        var run = runOpt.get();
        var statusResponse = new ReportStatusResponse(
            run.getStatus(),
            run.getCreatedAt(),
            run.getStartedAt(),
            run.getFinishedAt(),
            run.getModuleStatuses()
        );

        return Response.ok(statusResponse)
            .header("Cache-Control", "no-cache, no-store")
            .build();
    }

}
