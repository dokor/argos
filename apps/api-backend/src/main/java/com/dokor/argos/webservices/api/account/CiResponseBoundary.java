package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.ci.errors.*;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.ext.Provider;
import java.util.Map;

/** Also normalizes failures raised before a resource (permissions, CSRF, parsing, unknown route). */
@Provider
public class CiResponseBoundary implements ContainerResponseFilter {
    public static boolean applies(String path) {
        return path.equals("account/ci") || path.startsWith("account/ci/") || path.equals("ci/v1") || path.startsWith("ci/v1/");
    }
    @Override public void filter(ContainerRequestContext request,ContainerResponseContext response) {
        if(!applies(request.getUriInfo().getPath())) return;
        response.getHeaders().putSingle("Cache-Control","private, no-store");
        response.getHeaders().putSingle("X-Content-Type-Options","nosniff");
        if(response.getStatus()<400 || response.getEntity() instanceof CiErrors.Envelope) return;
        String internal=response.getEntity() instanceof Map<?,?> values ? String.valueOf(values.get("error")) : "";
        var code=response.getStatus()==401 ? CiErrorCode.AUTHENTICATION_FAILED
            : internal.equals("csrf_invalid") ? CiErrorCode.REQUEST_REJECTED
            : response.getStatus()==403 ? CiErrorCode.PERMISSION_DENIED
            : response.getStatus()==404 ? CiErrorCode.RESOURCE_NOT_AVAILABLE
            : response.getStatus()==429 ? CiErrorCode.RATE_LIMITED
            : response.getStatus()<500 ? CiErrorCode.CONFIG_INVALID : CiErrorCode.INTERNAL_ERROR;
        response.getHeaders().remove("Retry-After");
        response.setStatus(code.httpStatus()); response.setEntity(CiErrors.create(code,null));
        response.getHeaders().putSingle("Content-Type","application/json");
    }
}
