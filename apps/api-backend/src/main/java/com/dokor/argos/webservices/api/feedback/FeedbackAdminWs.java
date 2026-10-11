package com.dokor.argos.webservices.api.feedback;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.feedback.FeedbackService;
import com.dokor.argos.webservices.api.account.*;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/account/admin/feedback") @AccountAccess("admin") @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class FeedbackAdminWs {
 private final FeedbackService feedback;private final AccountCsrf csrf;
 @Context private Provider<ContainerRequestContext> requests;
 @Inject public FeedbackAdminWs(FeedbackService feedback,AccountCsrf csrf) {this.feedback=feedback;this.csrf=csrf;}
 private String auth() {return requests.get().getHeaderString("Authorization");}
 @GET public Response list(@QueryParam("type") String type,@QueryParam("status") String status,@QueryParam("limit") @DefaultValue("20") int limit,@QueryParam("cursor") String cursor) {return AccountAuthWs.ok(feedback.list(auth(),type,status,limit,cursor));}
 @GET @Path("/{id}") public Response detail(@PathParam("id") String id) {return AccountAuthWs.ok(feedback.detail(auth(),AdminService.id(id)));}
 @PATCH @Path("/{id}") public Response treat(@PathParam("id") String id,FeedbackService.Treatment body) {return AccountAuthWs.ok(feedback.treat(auth(),csrf.require(requests.get()),AdminService.id(id),body));}
}
