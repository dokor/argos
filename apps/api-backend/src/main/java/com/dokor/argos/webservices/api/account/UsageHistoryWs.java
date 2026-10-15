package com.dokor.argos.webservices.api.account;
import com.dokor.argos.services.account.UsageHistoryService;
import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
@Path("/account/usage/events") @AccountAccess("verified") @Singleton @Produces(MediaType.APPLICATION_JSON)
public final class UsageHistoryWs {
    private final UsageHistoryService service;
    @Inject public UsageHistoryWs(UsageHistoryService service){this.service=service;}
    @GET public Response events(@HeaderParam("Authorization") String auth,@QueryParam("period") String period,
        @QueryParam("limit") @DefaultValue("20") int limit,@QueryParam("offset") @DefaultValue("0") long offset){
        return AccountAuthWs.ok(service.events(auth,period,limit,offset));
    }
}
