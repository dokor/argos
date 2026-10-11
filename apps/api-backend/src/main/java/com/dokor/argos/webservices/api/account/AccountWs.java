package com.dokor.argos.webservices.api.account;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.services.account.*;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

import java.util.*;

@Path("/account")
@AccountAccess
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AccountWs {
    public record Profile(String displayName) {}

    public record Password(String password) {}

    public record Confirmation(boolean confirmed) {}

    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final AccountAuthService auth;
    private final AccountRunsService runs;
    private final AccountSitesService sites;
    private final AccountCsrf csrf;
    private final AccountRateLimiter rate;
    @Context private Provider<ContainerRequestContext> requests;
    @Context private Provider<org.glassfish.grizzly.http.server.Request> nativeRequests;

    private ContainerRequestContext request() {
        return requests.get();
    }

    @Inject
    public AccountWs(
            AccountDao dao,
            AccountSessionService sessions,
            AccountAuthService auth,
            AccountRunsService runs,
            AccountCsrf csrf,
            AccountRateLimiter rate, AccountSitesService sites) {
        this.dao = dao;
        this.sessions = sessions;
        this.auth = auth;
        this.runs = runs;
        this.csrf = csrf;
        this.rate = rate; this.sites=sites;
    }

    private String auth() {
        return request().getHeaderString("Authorization");
    }

    public record SiteInput(String url) {}
    @GET @Path("/sites") @AccountAccess("verified")
    public Response sites(@QueryParam("limit") @DefaultValue("20") int limit,@QueryParam("cursor") String cursor) {
        return AccountAuthWs.ok(sites.list(auth(),limit,cursor));
    }
    @GET @Path("/sites/{id}") @AccountAccess("verified")
    public Response site(@PathParam("id") long id) { return AccountAuthWs.ok(sites.get(auth(),id)); }
    @GET @Path("/sites/{id}/urls") @AccountAccess("verified")
    public Response urls(@PathParam("id") long id,@QueryParam("limit") @DefaultValue("20") int limit,@QueryParam("cursor") String cursor) {
        return AccountAuthWs.ok(sites.urls(auth(),id,limit,cursor));
    }
    @POST @Path("/sites") @AccountAccess("verified")
    public Response addSite(SiteInput body) { return addUrl(null,body); }
    @POST @Path("/sites/{id}/urls") @AccountAccess("verified")
    public Response addSiteUrl(@PathParam("id") long id,SiteInput body) { return addUrl(id,body); }
    private Response addUrl(Long id,SiteInput body) {
        if(body==null || body.url()==null || body.url().length()>2048) throw new AccountError(400,"url_invalid");
        return AccountAuthWs.ok(sites.add(auth(),csrf.require(request()),id,body.url()));
    }

    @GET
    @Path("/me")
    public Response me(@Context AccountSessionService.Context context) {
        return AccountAuthWs.ok(AccountAuthWs.profile(context.user()));
    }

    @PATCH
    @Path("/me")
    @AccountAccess("verified")
    public Response update(Profile body) {
        if (body == null) throw new AccountError(400, "payload_invalid");
        String token = csrf.require(request()),
                name = AccountAuthService.displayName(body.displayName());
        return AccountAuthWs.ok(
                sessions.with(
                        auth(),
                        token,
                        true,
                        true,
                        (context, c) -> {
                            context.user().setDisplayName(name);
                            dao.save(context.user(), c);
                            return AccountAuthWs.profile(context.user());
                        }));
    }

    @POST
    @Path("/me/archive")
    public Response archive(Confirmation body) {
        auth.archive(auth(), csrf.require(request()), body != null && body.confirmed());
        return AccountAuthWs.ok(Map.of("accepted", true));
    }

    @GET
    @Path("/sessions")
    @AccountAccess("verified")
    public Response sessions() {
        return AccountAuthWs.ok(
                sessions.with(
                        auth(),
                        null,
                        true,
                        true,
                        (context, c) ->
                                dao.sessions(context.user().getId(), c).stream()
                                        .map(
                                                s ->
                                                        Map.of(
                                                                "id",
                                                                s.getId().toString(),
                                                                "createdAt",
                                                                s.getCreatedAt().toString(),
                                                                "current",
                                                                s.getId()
                                                                        .equals(
                                                                                context.session()
                                                                                        .getId())))
                                        .toList()));
    }

    @DELETE
    @Path("/sessions/{id}")
    @AccountAccess("verified")
    public Response revoke(@PathParam("id") long id) {
        String token = csrf.require(request());
        sessions.with(
                auth(),
                token,
                true,
                true,
                (context, c) -> {
                    sessions.recent(context);
                    var session = dao.session(id, c, true);
                    if (session == null || !session.getUserId().equals(context.user().getId()))
                        throw AccountError.missing();
                    sessions.revoke(session, c);
                    sessions.event(
                            "session_revoke",
                            "accepted",
                            context.user().getId(),
                            context.session().getId(),
                            c);
                    return null;
                });
        return AccountAuthWs.ok(Map.of("accepted", true));
    }

    @POST
    @Path("/sessions/revoke-others")
    @AccountAccess("verified")
    public Response revokeOthers() {
        sessions.with(
                auth(),
                csrf.require(request()),
                true,
                true,
                (context, c) -> {
                    sessions.recent(context);
                    sessions.revokeAll(context.user().getId(), context.session().getId(), c);
                    return null;
                });
        return AccountAuthWs.ok(Map.of("accepted", true));
    }

    @GET
    @Path("/methods")
    @AccountAccess("verified")
    public Response methods() {
        return AccountAuthWs.ok(
                sessions.with(
                        auth(),
                        null,
                        true,
                        true,
                        (context, c) ->
                                dao.identities(context.user().getId(), c).stream()
                                        .map(
                                                i ->
                                                        Map.of(
                                                                "id",
                                                                i.getId().toString(),
                                                                "provider",
                                                                i.getProvider()))
                                        .toList()));
    }

    @POST
    @Path("/methods/password")
    @AccountAccess("verified")
    public Response password(Password body) {
        if (body == null) throw new AccountError(400, "payload_invalid");
        String token = csrf.require(request());
        rate.check("login", null, AccountAuthWs.remote(nativeRequests.get()));
        auth.addPassword(auth(), token, body.password());
        return AccountAuthWs.ok(Map.of("accepted", true));
    }

    @POST
    @Path("/methods/{id}/remove")
    @AccountAccess("verified")
    public Response remove(@PathParam("id") long id, Confirmation body) {
        if (body == null || !body.confirmed()) throw new AccountError(400, "confirmation_required");
        auth.removeMethod(auth(), csrf.require(request()), id);
        return AccountAuthWs.ok(Map.of("accepted", true));
    }

    @GET
    @Path("/runs")
    @AccountAccess("verified")
    public Response list(@QueryParam("limit") @DefaultValue("20") int limit) {
        return AccountAuthWs.ok(runs.list(auth(), limit));
    }

    @GET
    @Path("/runs/{id}")
    @AccountAccess("verified")
    public Response run(@PathParam("id") long id) {
        return AccountAuthWs.ok(runs.get(auth(), id));
    }

    @GET
    @Path("/runs/{id}/report")
    @AccountAccess("verified")
    public Response report(@PathParam("id") long id) {
        return AccountAuthWs.ok(runs.report(auth(), id));
    }

    @POST
    @Path("/runs/{id}/claim")
    @AccountAccess("verified")
    public Response claim(@PathParam("id") long id) {
        String token = csrf.require(request());
        rate.check("claim", null, AccountAuthWs.remote(nativeRequests.get()));
        runs.claim(auth(), token, id, request().getHeaderString("X-Argos-Run-Proof"));
        return AccountAuthWs.ok(Map.of("accepted", true));
    }
}
