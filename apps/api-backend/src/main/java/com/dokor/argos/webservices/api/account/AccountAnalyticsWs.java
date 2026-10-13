package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.analytics.ProductAnalyticsService;
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

    @Inject
    public AccountAnalyticsWs(AccountSessionService sessions, ProductAnalyticsService analytics) {
        this.sessions = sessions;
        this.analytics = analytics;
    }

    @GET
    public Response metrics(@DefaultValue("30") @QueryParam("days") int days,
                            @HeaderParam("Authorization") String authorization) {
        return AccountAuthWs.ok(sessions.with(authorization, null, true, false,
            (context, connection) -> analytics.metrics(days, context)));
    }
}
