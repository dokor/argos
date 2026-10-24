package com.dokor.argos.webservices.api.account;
import com.dokor.argos.services.ci.CiKeysService;
import com.dokor.argos.services.ci.CiRateService;
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
    private final CiRateService rates;
    public static final String PEER_PROPERTY=CiKeyFilter.class.getName()+".peer";
    @Context private jakarta.inject.Provider<org.glassfish.grizzly.http.server.Request> transport;
    public CiKeyFilter(CiKeysService keys){this.keys=keys;this.rates=null;}
    @Inject public CiKeyFilter(CiKeysService keys,CiRateService rates){this.keys=keys;this.rates=rates;}
    @Override public void filter(ContainerRequestContext request) {
        String path=CiResponseBoundary.normalizedPath(request.getUriInfo().getPath());
        if(!path.equals("ci") && !path.startsWith("ci/")) return;
        try {
            String peer=transport==null?"direct":AccountAuthWs.remote(transport.get());
            if(rates!=null && keys.enabled()) rates.ingress(peer);
            var identity=keys.withCredential(request.getHeaderString("Authorization"),peer,null,(ctx,c)->ctx);
            if(rates!=null) rates.traffic(identity,!java.util.Set.of("GET","HEAD").contains(request.getMethod()));
            if(request.getLength()>8192) throw com.dokor.argos.services.ci.CiAccountOperations.fail(com.dokor.argos.services.ci.errors.CiErrorCode.CONFIG_INVALID);
            if(request.hasEntity()) request.setEntityStream(new LimitedBody(request.getEntityStream()));
            request.setProperty(PEER_PROPERTY,peer);
            request.setProperty(CiKeysService.Context.class.getName(),identity);
        }catch(WebApplicationException rejected){request.abortWith(rejected.getResponse());}
    }
    private static final class LimitedBody extends java.io.FilterInputStream {
        private int remaining=8192;
        LimitedBody(java.io.InputStream source){super(source);}
        @Override public int read() throws java.io.IOException {
            int value=in.read();if(value>=0 && --remaining<0)throw new java.io.IOException("CI body limit");return value;
        }
        @Override public int read(byte[] value,int offset,int length) throws java.io.IOException {
            int count=in.read(value,offset,Math.min(length,remaining+1));
            if(count>0 && (remaining-=count)<0)throw new java.io.IOException("CI body limit");return count;
        }
    }
}
