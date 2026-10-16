package com.dokor.argos.webservices.api.account;
import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.analytics.TrafficAnalyticsService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
@Path("/account/admin/traffic") @AccountAccess("admin") @Produces(MediaType.APPLICATION_JSON) @Singleton
public class AccountTrafficWs {
 private final AccountSessionService sessions;private final TrafficAnalyticsService traffic;
 @Inject public AccountTrafficWs(AccountSessionService sessions,TrafficAnalyticsService traffic){this.sessions=sessions;this.traffic=traffic;}
 @GET public Response metrics(@DefaultValue("30")@QueryParam("days")int days,@DefaultValue("day")@QueryParam("group")String group,@HeaderParam("Authorization")String auth){return AccountAuthWs.ok(sessions.with(auth,null,true,false,(ctx,c)->traffic.metrics(days,group,ctx)));}
}
