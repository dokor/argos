package com.dokor.argos.webservices.api.account;

import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.token.TokenService;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

import java.util.*;

@Path("/account/auth")
@PublicApi
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AccountAuthWs {
    public record Registration(String email, String password, String displayName) {}

    public record Login(String email, String password) {}

    public record Email(String email) {}

    public record Token(String token, String password) {}

    public record Reauth(String password, String code) {}

    public record OAuthStart(String intent, String returnTo) {}

    private final AccountAuthService auth;
    private final AccountSessionService sessions;
    private final AccountOAuthService oauth;
    private final AccountCsrf csrf;
    private final AccountRateLimiter rate;
    private final TokenService tokens;
    private final AccountSettings settings;
    @Context private Provider<ContainerRequestContext> requests;
    @Context private Provider<org.glassfish.grizzly.http.server.Request> nativeRequests;

    private ContainerRequestContext request() {
        return requests.get();
    }

    @Inject
    public AccountAuthWs(
            AccountAuthService auth,
            AccountSessionService sessions,
            AccountOAuthService oauth,
            AccountCsrf csrf,
            AccountRateLimiter rate,
            TokenService tokens,
            AccountSettings settings) {
        this.auth = auth;
        this.sessions = sessions;
        this.oauth = oauth;
        this.csrf = csrf;
        this.rate = rate;
        this.tokens = tokens;
        this.settings = settings;
    }

    private String authorization() {
        return request().getHeaderString("Authorization");
    }

    private String mutation(String action, String email) {
        String token = csrf.require(request());
        rate.check(action, email, remote(nativeRequests.get()));
        return token;
    }

    public static String remote(org.glassfish.grizzly.http.server.Request request) {
        return request == null ? "direct" : request.getRemoteAddr();
    }

    public static Response ok(Object entity) {
        return Response.ok(entity).header("Cache-Control", "private, no-store").build();
    }

    public static Map<String, Object> profile(com.dokor.argos.db.generated.AccountUser u) {
        var p = new LinkedHashMap<String, Object>();
        p.put("displayName", u.getDisplayName());
        p.put("email", u.getEmail());
        p.put("verified", "ACTIVE".equals(u.getState()));
        p.put("admin", "ACTIVE".equals(u.getState()) && "ADMIN".equals(u.getRole()));
        return p;
    }

    @GET
    @Path("/providers")
    public Response providers() {
        return ok(Map.of("providers", oauth.providers(), "enabled", settings.enabled()));
    }

    @POST
    @Path("/register")
    @com.dokor.argos.webservices.api.security.AntiBot("register")
    public Response register(Registration b) {
        if (b == null) throw new AccountError(400, "payload_invalid");
        mutation("email", AccountAuthService.email(b.email()));
        auth.register(b.email(), b.password(), b.displayName(), request().getHeaderString("Accept-Language"));
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/login")
    public Response login(Login b) {
        if (b == null) throw new AccountError(400, "payload_invalid");
        String token = mutation("login", AccountAuthService.email(b.email()));
        var result = auth.login(b.email(), b.password(), token);
        return Response.ok(profile(result.context().user()))
                .header("X-Argos-Session", result.jwt())
                .header("Cache-Control", "private, no-store")
                .build();
    }

    @POST
    @Path("/verify")
    public Response verify(Token b) {
        mutation("email", null);
        if (b == null) throw new AccountError(400, "payload_invalid");
        auth.verify(b.token());
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/resend")
    @com.dokor.argos.webservices.api.security.AntiBot("resend")
    public Response resend(Email b) {
        if (b == null) throw new AccountError(400, "payload_invalid");
        mutation("email", AccountAuthService.email(b.email()));
        auth.send(b.email(), "VERIFY");
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/forgot")
    @com.dokor.argos.webservices.api.security.AntiBot("forgot")
    public Response forgot(Email b) {
        if (b == null) throw new AccountError(400, "payload_invalid");
        mutation("email", AccountAuthService.email(b.email()));
        auth.send(b.email(), "RESET", request().getHeaderString("Accept-Language"));
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/reset")
    public Response reset(Token b) {
        mutation("email", null);
        if (b == null) throw new AccountError(400, "payload_invalid");
        auth.reset(b.token(), b.password());
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/confirm-email")
    @AccountAccess
    public Response confirm(Email b) {
        String token = mutation("email", null);
        if (b == null) throw new AccountError(400, "payload_invalid");
        auth.confirmEmail(authorization(), token, b.email());
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/reauth")
    @AccountAccess
    public Response reauth(Reauth b) {
        String token = mutation("login", null);
        if (b == null) throw new AccountError(400, "payload_invalid");
        auth.reauth(authorization(), token, b.password(), b.code());
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/renew")
    @AccountAccess
    public Response renew() {
        String token = csrf.require(request());
        String jwt = sessions.renew(authorization(), token);
        return Response.ok(Map.of("accepted", true))
                .header("X-Argos-Session", jwt)
                .header("Cache-Control", "private, no-store")
                .build();
    }

    @POST
    @Path("/logout")
    @AccountAccess
    public Response logout() {
        String token = csrf.require(request());
        sessions.with(
                authorization(),
                token,
                false,
                false,
                (context, c) -> {
                    sessions.revoke(context.session(), c);
                    sessions.event(
                            "logout",
                            "accepted",
                            context.user().getId(),
                            context.session().getId(),
                            c);
                    return null;
                });
        return ok(Map.of("accepted", true));
    }

    @POST
    @Path("/oauth/{provider}/start")
    public Response start(@PathParam("provider") String provider, OAuthStart body) {
        String token = mutation("oauth", null);
        if (body == null) throw new AccountError(400, "payload_invalid");
        var start = oauth.start(provider, body.intent(), body.returnTo(), authorization(), token);
        return Response.ok(Map.of("url", start.url(), "state", start.state()))
                .header("X-Argos-OAuth-Browser", start.browser())
                .header("Cache-Control", "private, no-store")
                .build();
    }

    @GET
    @Path("/oauth/{provider}/callback")
    public Response callback(
            @PathParam("provider") String provider,
            @QueryParam("state") String state,
            @QueryParam("code") String code) {
        rate.check("oauth", null, remote(nativeRequests.get()));
        var cookie = request().getCookies().get(AccountCsrf.COOKIE);
        var result =
                oauth.finish(
                        provider,
                        state,
                        request().getHeaderString("X-Argos-OAuth-Browser"),
                        code,
                        authorization(),
                        cookie == null ? null : cookie.getValue());
        var response =
                Response.ok(Map.of("returnTo", result.returnPath()))
                        .header("Cache-Control", "private, no-store");
        if (result.jwt() != null) response.header("X-Argos-Session", result.jwt());
        return response.build();
    }
}
