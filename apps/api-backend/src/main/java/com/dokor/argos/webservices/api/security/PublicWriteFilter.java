package com.dokor.argos.webservices.api.security;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.core.*;
import jakarta.ws.rs.ext.Provider;
import org.glassfish.grizzly.http.server.Request;
import java.util.Map;

@Provider
@PreMatching
@Priority(Priorities.AUTHENTICATION - 10)
public class PublicWriteFilter implements ContainerRequestFilter {
    public static final String CLIENT_HINT = PublicWriteFilter.class.getName() + ".clientHint";
    private final PublicWriteLimiter limiter;
    @Inject private jakarta.inject.Provider<Request> transport;
    @Inject public PublicWriteFilter(PublicWriteLimiter limiter) { this.limiter = limiter; }
    @Override public void filter(ContainerRequestContext request) {
        if (!"POST".equals(request.getMethod())) return;
        String path = request.getUriInfo().getPath().replaceAll("^/+|/+$", "");
        PublicWriteLimiter.Route route = switch (path) {
            case "audits" -> PublicWriteLimiter.Route.AUDIT;
            case "newsletter/subscribe" -> PublicWriteLimiter.Route.NEWSLETTER;
            default -> null;
        };
        if (route == null) return;
        Request connection = transport == null ? null : transport.get();
        String peer = connection == null ? null : connection.getRemoteAddr();
        String hint = limiter.clientHint(peer);
        if (hint != null) request.setProperty(CLIENT_HINT, hint);
        long retry = limiter.acquire(route, peer);
        if (retry > 0) request.abortWith(Response.status(429).type(MediaType.APPLICATION_JSON_TYPE)
            .header("Retry-After", retry).header("Cache-Control", "no-store")
            .entity(Map.of("error", "Rate limit exceeded")).build());
    }
}
