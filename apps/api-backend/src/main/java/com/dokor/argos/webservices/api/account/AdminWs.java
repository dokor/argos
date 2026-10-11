package com.dokor.argos.webservices.api.account;
import com.dokor.argos.services.account.*;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;
import java.util.*;
@Path("/account/admin") @AccountAccess("admin") @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class AdminWs {
 private final AdminService admin;private final AccountCsrf csrf;
 @Context private Provider<ContainerRequestContext> requests;
 @Inject public AdminWs(AdminService admin,AccountCsrf csrf) {this.admin=admin;this.csrf=csrf;}
 private String auth() {return requests.get().getHeaderString("Authorization");}
 @GET @Path("/users")
 public Response users(@QueryParam("q") String q,@QueryParam("state") String state,@QueryParam("offer") String offer,@QueryParam("limit") @DefaultValue("20") int limit,@QueryParam("cursor") String cursor) {
  return AccountAuthWs.ok(admin.users(auth(),q,state,offer,limit,cursor));
 }
 @GET @Path("/users/{id}") public Response user(@PathParam("id") String id) {return AccountAuthWs.ok(admin.user(auth(),AdminService.id(id)));}
 @PATCH @Path("/users/{id}/entitlement")
 public Response entitlement(@PathParam("id") String id,Map<String,Object> body) {
  if(body==null || !body.keySet().equals(Set.of("offer","monthlyLimit","confirmed")) || !(body.get("offer") instanceof String) || !Boolean.TRUE.equals(body.get("confirmed")))
   throw new AccountError(400,"payload_invalid");
  Object limit=body.get("monthlyLimit");
  if(limit!=null && !(limit instanceof Integer || limit instanceof Long)) throw new AccountError(400,"payload_invalid");
  return AccountAuthWs.ok(admin.entitlement(auth(),csrf.require(requests.get()),AdminService.id(id),
   new AdminService.Entitlement((String)body.get("offer"),limit==null?null:((Number)limit).longValue(),true)));
 }
 @GET @Path("/queue") public Response queue() {return AccountAuthWs.ok(admin.queue(auth()));}
 @GET @Path("/runs")
 public Response runs(@QueryParam("user") String user,@QueryParam("site") String site,@QueryParam("status") String status,@QueryParam("from") String from,@QueryParam("until") String until,@QueryParam("limit") @DefaultValue("20") int limit,@QueryParam("cursor") String cursor) {
  return AccountAuthWs.ok(admin.runs(auth(),user,site,status,from,until,limit,cursor));
 }
 @GET @Path("/runs/{id}") public Response run(@PathParam("id") String id) {return AccountAuthWs.ok(admin.run(auth(),AdminService.id(id)));}
 @GET @Path("/runs/{id}/report") public Response report(@PathParam("id") String id) {return AccountAuthWs.ok(admin.report(auth(),AdminService.id(id)));}
 @GET @Path("/events") public Response events(@QueryParam("limit") @DefaultValue("20") int limit,@QueryParam("cursor") String cursor) {return AccountAuthWs.ok(admin.events(auth(),limit,cursor));}
}
