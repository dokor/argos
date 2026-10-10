package com.dokor.argos.webservices.api;
import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.analytics.*;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
@Path("/product-analytics") @Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON) @PublicApi @Singleton
public class ProductAnalyticsWs {
    private final ProductAnalyticsService analytics;
    @Inject public ProductAnalyticsWs(ProductAnalyticsService analytics){this.analytics=analytics;}
    @POST public Response count(ProductEvent event,@HeaderParam("Authorization")String authorization){if(event==null)throw new BadRequestException();analytics.count(event,authorization);return Response.noContent().build();}
    @GET @Path("/metrics") public ProductMetrics.Summary metrics(@DefaultValue("30")@QueryParam("days")int days,@HeaderParam("Authorization")String authorization){return analytics.metrics(days,authorization);}
}
