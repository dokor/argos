package com.dokor.argos.webservices.api.security;

import jakarta.annotation.Priority;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.io.*;
import java.util.Map;

/** Bound bytes before Jackson/validation, also for direct API and chunked bodies. */
@Provider @PreMatching @Priority(1001)
public class AuditBodyFilter implements ContainerRequestFilter {
    static final int MAX_BYTES = 8192;
    @Override public void filter(ContainerRequestContext request) throws IOException {
        if (!"POST".equals(request.getMethod())) return;
        String path = request.getUriInfo().getPath().replaceAll("^/+|/+$", "");
        if (!path.equals("audits") && !path.matches("account/(sites(?:/\\d+/urls)?|(?:runs|urls)/\\d+/relaunch)")) return;
        byte[] bytes = request.getEntityStream().readNBytes(MAX_BYTES + 1);
        if (bytes.length > MAX_BYTES) {
            request.abortWith(Response.status(413).type("application/json").header("Cache-Control", "no-store")
                .entity(Map.of("error", "Payload too large")).build());
            return;
        }
        request.setEntityStream(new ByteArrayInputStream(bytes));
    }
}
