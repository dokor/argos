package com.dokor.argos.webservices.api.premium;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.premium.PremiumWaitlistService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.Map;

@Path("/premium-waitlist")
@PublicApi
@Singleton
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class PremiumWaitlistWs {
    private final PremiumWaitlistService service;
    @Inject public PremiumWaitlistWs(PremiumWaitlistService service) { this.service = service; }
    public record SubscribeRequest(String email, Boolean consent, String locale) {}
    @POST public Response subscribe(SubscribeRequest request) {
        boolean accepted = request != null && service.subscribe(request.email(), request.consent(), request.locale());
        return Response.status(accepted ? 200 : 400).header("Cache-Control", "no-store")
            .entity(Map.of("status", accepted ? "ok" : "error")).build();
    }
}
