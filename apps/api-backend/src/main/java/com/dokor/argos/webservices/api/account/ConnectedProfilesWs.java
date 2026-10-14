package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.connected.ConnectedProfiles;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/account/analysis-profiles")
@AccountAccess("verified")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
public final class ConnectedProfilesWs {
    private final AccountSessionService sessions;
    private final ConnectedProfiles profiles;
    @Inject public ConnectedProfilesWs(AccountSessionService sessions, ConnectedProfiles profiles) {
        this.sessions = sessions;
        this.profiles = profiles;
    }
    @GET public Response get(@HeaderParam("Authorization") String authorization) {
        return sessions.with(authorization, null, true, false,
                (context, connection) -> AccountAuthWs.ok(profiles.catalogue()));
    }
}
