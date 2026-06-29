package com.dokor.argos.webservices.api.newsletter;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.domain.newsletter.NewsletterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/newsletter")
@Tag(name = "newsletter", description = "Newsletter subscription")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PublicApi
@Singleton
public class NewsletterWs {

    private static final Logger logger = LoggerFactory.getLogger(NewsletterWs.class);

    private final NewsletterService newsletterService;

    @Inject
    public NewsletterWs(NewsletterService newsletterService) {
        this.newsletterService = newsletterService;
    }

    public record SubscribeRequest(String email) {}

    public record SubscribeResponse(String status, String message) {}

    @POST
    @Path("/subscribe")
    @Operation(description = "Inscrit un email à la newsletter Argos.")
    public Response subscribe(SubscribeRequest request, @Context HttpHeaders headers) {
        if (request == null || request.email() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new SubscribeResponse("error", "Email is required"))
                .build();
        }

        // IP hint (best effort, peut être absent derrière un proxy)
        String ipHint = headers.getHeaderString("X-Forwarded-For");
        if (ipHint != null && ipHint.contains(",")) {
            ipHint = ipHint.split(",")[0].trim();
        }

        logger.info("Newsletter subscribe requested email={}", request.email());

        return switch (newsletterService.subscribe(request.email(), ipHint)) {
            case SUBSCRIBED -> Response.ok(new SubscribeResponse("ok", "Subscribed successfully")).build();
            case ALREADY_SUBSCRIBED -> Response.status(409).entity(new SubscribeResponse("already_subscribed", "Email already registered")).build();
            case INVALID_EMAIL -> Response.status(Response.Status.BAD_REQUEST).entity(new SubscribeResponse("error", "Invalid email address")).build();
        };
    }
}
