package com.dokor.argos.webservices.api.report;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.report.ReportReadService;
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

import java.security.NoSuchAlgorithmException;

@Path("/reports")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi
@Singleton
public class ReportsWs {

    private static final Logger logger = LoggerFactory.getLogger(ReportsWs.class);
    private final ReportReadService reportReadService;

    @Inject
    public ReportsWs(ReportReadService reportReadService) {
        this.reportReadService = reportReadService;
    }

    @GET
    @Path("/{token}")
    public Response getReport(@PathParam("token") String token) {
        logger.debug("Get report token={}", token);
//        logger.info("Get report token={}", safeToken(token));
        var reportOpt = reportReadService.getByToken(token);
        if (reportOpt.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(reportOpt.get())
            .header("X-Robots-Tag", "noindex, nofollow")
            .header("Cache-Control", "private, no-store")
            .build();
    }

    private static String safeToken(String token) {
        if (token == null) return "null";
        return token.length() <= 8 ? "****" : token.substring(0, 4) + "…" + token.substring(token.length() - 4);
    }
}
