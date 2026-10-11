package com.dokor.argos.webservices.api.account;

import com.coreoz.plume.jersey.security.permission.PermissionRequestProvider;
import com.dokor.argos.services.account.*;

import jakarta.inject.*;
import jakarta.ws.rs.container.ContainerRequestContext;

import java.util.*;

/**
 * Plume declarative gate plus current registry checks. Ownership remains enforced by services/SQL.
 */
@Singleton
public class AccountPermissionProvider implements PermissionRequestProvider {
    private final AccountSessionService sessions;

    @Inject
    public AccountPermissionProvider(AccountSessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    public Collection<String> correspondingPermissions(ContainerRequestContext request) {
        return sessions.with(
                request.getHeaderString("Authorization"),
                null,
                false,
                false,
                (context, c) -> {
                    request.setProperty(AccountSessionService.Context.class.getName(), context);
                    return "ACTIVE".equals(context.user().getState())
                            ? List.of("session", "verified")
                            : List.of("session");
                });
    }

    @Override
    public String userInformation(ContainerRequestContext request) {
        var context =
                (AccountSessionService.Context)
                        request.getProperty(AccountSessionService.Context.class.getName());
        return context == null ? "account" : context.user().getId().toString();
    }
}
