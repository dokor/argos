package com.dokor.argos.webservices.api.feedback;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.feedback.FeedbackService;
import com.dokor.argos.webservices.api.account.AccountAuthWs;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

@Path("/feedback") @PublicApi @Singleton
@Produces(MediaType.APPLICATION_JSON) @Consumes(MediaType.APPLICATION_JSON)
public class FeedbackWs {
 private final FeedbackService feedback;
 private final AccountCsrf csrf;
 private final AccountRateLimiter rate;
 @Context private Provider<ContainerRequestContext> requests;
 @Context private Provider<org.glassfish.grizzly.http.server.Request> nativeRequests;
 @Inject public FeedbackWs(FeedbackService feedback,AccountCsrf csrf,AccountRateLimiter rate) {this.feedback=feedback;this.csrf=csrf;this.rate=rate;}
 @POST public Response submit(FeedbackService.Submission body) {
  var request=requests.get();String token=csrf.require(request);
  rate.check("feedback",token,AccountAuthWs.remote(nativeRequests.get()));
  return AccountAuthWs.ok(feedback.submit(request.getHeaderString("Authorization"),token,body));
 }
}
