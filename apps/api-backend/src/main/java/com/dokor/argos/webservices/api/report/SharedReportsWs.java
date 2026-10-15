package com.dokor.argos.webservices.api.report;
import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.report.ReportSharingService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

@Path("/reports/shared") @PublicApi @Singleton @Produces(MediaType.APPLICATION_JSON)
public class SharedReportsWs {
    private final ReportSharingService sharing;
    @Inject public SharedReportsWs(ReportSharingService sharing){this.sharing=sharing;}
    @GET @Path("/{token}") public Response get(@PathParam("token") String token) {
        var report=sharing.shared(token);
        return (report.isPresent()?Response.ok(report.get().publicSummary()):Response.status(404))
            .header("Cache-Control","private, no-store").header("X-Robots-Tag","noindex, nofollow").build();
    }
}
