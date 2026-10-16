package com.dokor.argos.webservices.api;
import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.analytics.*;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
@Path("/traffic-analytics") @Consumes(MediaType.APPLICATION_JSON) @PublicApi @Singleton
public class TrafficAnalyticsWs {
 private final TrafficAnalyticsService traffic;
 @Inject public TrafficAnalyticsWs(TrafficAnalyticsService traffic){this.traffic=traffic;}
 @POST public Response count(TrafficEvent event,@HeaderParam("Authorization")String auth){if(event==null)throw new BadRequestException();return Response.status(traffic.count(event,auth)?204:202).build();}
}
