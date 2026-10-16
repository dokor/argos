package com.dokor.argos.webservices.api.security;

import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.security.AntiBotService;
import jakarta.inject.*;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.ext.Provider;

/** Runs at the authoritative Java boundary, including requests bypassing the BFF. */
@Provider @Singleton
public class AntiBotFilter implements ContainerRequestFilter {
    private final AntiBotService antiBot;
    private final AccountSessionService sessions;
    @jakarta.ws.rs.core.Context private ResourceInfo resource;
    @Inject public AntiBotFilter(AntiBotService antiBot, AccountSessionService sessions) { this.antiBot = antiBot; this.sessions = sessions; }
    AntiBotFilter(AntiBotService antiBot, AccountSessionService sessions, ResourceInfo resource) { this(antiBot,sessions); this.resource=resource; }
    @Override public void filter(ContainerRequestContext request) {
        // Inspect the matched resource, not raw URI spelling (matrix params, encoding, trailing slash).
        var method = resource.getResourceMethod();
        AntiBot annotation = method == null ? null : method.getAnnotation(AntiBot.class);
        if (annotation == null || !antiBot.enabled()) return;
        String action = annotation.value();
        if (action.equals("audit") || action.equals("feedback")) {
            String credential = request.getHeaderString(action.equals("audit") ? "X-Argos-Account-Session" : "Authorization");
            // Merely supplying a header is never an exemption: check the live session in the DB.
            if (credential != null) { sessions.with(credential, null, false, false, (ctx, c) -> true); return; }
        }
        antiBot.require(request.getHeaderString(AntiBotService.HEADER), action);
    }
}
