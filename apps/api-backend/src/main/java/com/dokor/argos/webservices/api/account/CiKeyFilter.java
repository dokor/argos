package com.dokor.argos.webservices.api.account;
import com.dokor.argos.services.ci.CiKeysService;
import jakarta.annotation.Priority;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.core.*;
import jakarta.ws.rs.ext.Provider;

/** Default deny for the entire machine namespace, including unknown routes and methods. */
@Provider @PreMatching @Priority(Priorities.AUTHENTICATION-20)
public class CiKeyFilter implements ContainerRequestFilter {
    private final CiKeysService keys;
    @Context private jakarta.inject.Provider<org.glassfish.grizzly.http.server.Request> transport;
    @Inject public CiKeyFilter(CiKeysService keys){this.keys=keys;}
    @Override public void filter(ContainerRequestContext request) {
        String path=CiResponseBoundary.normalizedPath(request.getUriInfo().getPath());
        if(!path.equals("ci") && !path.startsWith("ci/")) return;
        try {
            String peer=transport==null?"direct":AccountAuthWs.remote(transport.get());
            var identity=keys.withCredential(request.getHeaderString("Authorization"),peer,null,(ctx,c)->ctx);
            request.setProperty(CiKeysService.Context.class.getName(),identity);
        }catch(WebApplicationException rejected){request.abortWith(rejected.getResponse());}
    }
}
