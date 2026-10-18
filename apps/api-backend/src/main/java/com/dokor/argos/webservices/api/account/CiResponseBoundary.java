package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.ci.errors.*;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.ext.Provider;
import java.util.Map;

/** Also normalizes failures raised before a resource (permissions, CSRF, parsing, unknown route). */
@Provider
public class CiResponseBoundary implements ContainerResponseFilter {
    private static final org.slf4j.Logger logger=org.slf4j.LoggerFactory.getLogger(CiResponseBoundary.class);
    public static boolean applies(String path) {
        path=path.replaceAll("^/+|/+$","");
        return path.equals("account/ci") || path.startsWith("account/ci/") || path.equals("ci") || path.startsWith("ci/");
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
        response.getHeaders().remove("Content-Length");
        var envelope=CiErrors.create(code,null);
        if(code==CiErrorCode.INTERNAL_ERROR) logger.error("ci_http_failed requestId={} category=internal",envelope.requestId());
        response.setStatus(code.httpStatus()); response.setEntity(envelope);
        response.getHeaders().putSingle("Content-Type","application/json");
    }
}
