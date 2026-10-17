package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.analytics.ProductAnalyticsService;
import com.dokor.argos.services.analytics.ProductMeasurementControl;
import com.dokor.argos.services.account.AccountCsrf;
import com.dokor.argos.services.account.AccountError;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import java.util.Map;
import java.util.Set;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/account/admin/analytics")
@AccountAccess("admin")
@Produces(MediaType.APPLICATION_JSON)
@Singleton
public class AccountAnalyticsWs {
    private final AccountSessionService sessions;
    private final ProductAnalyticsService analytics;
    private final ProductMeasurementControl control;
    private final AccountCsrf csrf;
    private final com.dokor.argos.services.analytics.AccountJourneyDao journey;
    @Context private jakarta.inject.Provider<ContainerRequestContext> requests;

    @Inject
    public AccountAnalyticsWs(AccountSessionService sessions, ProductAnalyticsService analytics,
            ProductMeasurementControl control, AccountCsrf csrf, com.dokor.argos.services.analytics.AccountJourneyDao journey) {
        this.sessions = sessions;
        this.analytics = analytics;
        this.control = control;
        this.csrf = csrf;
        this.journey = journey;
    }

    @GET
    public Response metrics(@DefaultValue("30") @QueryParam("days") int days,
                            @HeaderParam("Authorization") String authorization) {
        return AccountAuthWs.ok(sessions.with(authorization, null, true, false,
            (context, connection) -> {
                var audits = analytics.metrics(days, context);
                return Map.of("audits", audits, "accounts", journey.summary(java.time.Instant.parse(audits.from()), java.time.Instant.parse(audits.until())));
            }));
    }

    @GET @Path("/settings")
    public Response settings(@HeaderParam("Authorization") String auth) {
        return AccountAuthWs.ok(control.read(auth));
    }

    @PATCH @Path("/settings") @Consumes(MediaType.APPLICATION_JSON)
    public Response change(@HeaderParam("Authorization") String auth, Map<String, Object> body) {
        String proof = csrf.require(requests.get());
        if (body == null || !body.keySet().equals(Set.of("enabled", "expectedVersion", "confirmation"))
                || !(body.get("enabled") instanceof Boolean) || !Boolean.TRUE.equals(body.get("confirmation"))
                || !(body.get("expectedVersion") instanceof Integer || body.get("expectedVersion") instanceof Long))
            throw new AccountError(400, "payload_invalid");
        return AccountAuthWs.ok(control.change(auth, proof, new ProductMeasurementControl.Change(
                (Boolean) body.get("enabled"), ((Number) body.get("expectedVersion")).longValue(), true)));
    }
}
