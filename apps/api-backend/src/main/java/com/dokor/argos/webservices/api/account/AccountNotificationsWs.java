package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.notifications.NotificationService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

@Path("/account/notifications") @AccountAccess @Produces(MediaType.APPLICATION_JSON) @Singleton
public class AccountNotificationsWs {
    private final AccountSessionService sessions; private final NotificationService notifications;
    @Inject public AccountNotificationsWs(AccountSessionService sessions,NotificationService notifications){this.sessions=sessions;this.notifications=notifications;}
    @GET public Response list(@HeaderParam("Authorization")String auth){return AccountAuthWs.ok(sessions.with(auth,null,false,false,(ctx,c)->notifications.list(ctx.user().getId(),c)));}
    @POST @Path("/{id}/read") public Response read(@PathParam("id")long id,@HeaderParam("Authorization")String auth,@HeaderParam("X-Argos-CSRF")String csrf){return mark(id,false,auth,csrf);}
    @POST @Path("/through/{id}/read") public Response all(@PathParam("id")long id,@HeaderParam("Authorization")String auth,@HeaderParam("X-Argos-CSRF")String csrf){return mark(id,true,auth,csrf);}
    private Response mark(long id,boolean all,String auth,String csrf){if(csrf==null)throw AccountError.forbidden("csrf_invalid");return AccountAuthWs.ok(sessions.with(auth,csrf,false,true,(ctx,c)->{notifications.read(ctx.user().getId(),id,all,c);return notifications.list(ctx.user().getId(),c);}));}
}
