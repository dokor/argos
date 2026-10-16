package com.dokor.argos.webservices.api.security;
import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.security.AntiBotService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
@Path("/antibot") @PublicApi @Singleton @Produces(MediaType.APPLICATION_JSON)
public class AntiBotWs {
    private final AntiBotService service;
    @Inject public AntiBotWs(AntiBotService service) { this.service = service; }
    @GET public Response config() { return Response.ok(service.publicConfig()).header("Cache-Control", "no-store").build(); }
}
