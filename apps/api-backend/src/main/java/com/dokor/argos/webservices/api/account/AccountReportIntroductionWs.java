package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.report.ReportIntroduction;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/report-introduction/{token}")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AccountReportIntroductionWs {
    private final AccountReportIntroductionService service;
    private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> requests;
    @Inject public AccountReportIntroductionWs(AccountReportIntroductionService service, AccountCsrf csrf) { this.service = service; this.csrf = csrf; }
    @GET public Response read(@PathParam("token") String token) {
        return AccountAuthWs.ok(service.read(requests.get().getHeaderString("Authorization"), token));
    }
    @PUT public Response publish(@PathParam("token") String token, ReportIntroduction input) {
        return AccountAuthWs.ok(service.publish(requests.get().getHeaderString("Authorization"), csrf.require(requests.get()), token, input));
    }
    @DELETE public Response revoke(@PathParam("token") String token) {
        return AccountAuthWs.ok(service.revoke(requests.get().getHeaderString("Authorization"), csrf.require(requests.get()), token));
    }
}
