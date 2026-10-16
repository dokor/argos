package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

import jakarta.inject.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.*;

import java.util.*;

@Path("/account/admin")
@AccountAccess("admin")
@Singleton
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminWs {
    private final AdminService admin;
    private final AccountCsrf csrf;
    @Context private Provider<ContainerRequestContext> requests;
    @Context private UriInfo uri;

    private void query(String... keys) {
        DomainSummariesWs.query(uri, Set.of(keys));
    }

    @Inject
    public AdminWs(AdminService admin, AccountCsrf csrf) {
        this.admin = admin;
        this.csrf = csrf;
    }

    private String auth() {
        return requests.get().getHeaderString("Authorization");
    }

    @GET
    @Path("/users")
    public Response users(
            @QueryParam("q") String q,
            @QueryParam("state") String state,
            @QueryParam("offer") String offer,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("cursor") String cursor) {
        query("q", "state", "offer", "limit", "cursor");
        return AccountAuthWs.ok(admin.users(auth(), q, state, offer, limit, cursor));
    }

    @GET
    @Path("/users/{id}")
    public Response user(@PathParam("id") String id) {
        query();
        return AccountAuthWs.ok(admin.user(auth(), AdminService.id(id)));
    }

    @GET
    @Path("/entitlement-options")
    public Response options() {
        query();
        return AccountAuthWs.ok(admin.options(auth()));
    }

    private static Long version(Map<String, Object> body) {
        Object v = body.get("expectedVersion");
        if (!(v instanceof Integer || v instanceof Long)
                || ((Number) v).longValue() < 0
                || ((Number) v).longValue() > 9007199254740991L)
            throw new AccountError(400, "payload_invalid");
        return ((Number) v).longValue();
    }

    private static AdminReason reason(Map<String, Object> body) {
        try {
            return AdminReason.valueOf((String) body.get("reasonCode"));
        } catch (Exception e) {
            throw new AccountError(400, "payload_invalid");
        }
    }

    @PATCH
    @Path("/users/{id}/entitlement")
    public Response entitlement(@PathParam("id") String id, Map<String, Object> body) {
        query();
        if (body == null
                || !body.keySet()
                        .equals(
                                Set.of(
                                        "offer",
                                        "monthlyLimit",
                                        "confirmation",
                                        "expectedVersion",
                                        "reasonCode"))
                || !(body.get("offer") instanceof String)
                || !Boolean.TRUE.equals(body.get("confirmation")))
            throw new AccountError(400, "payload_invalid");
        Object limit = body.get("monthlyLimit");
        if (limit != null && !(limit instanceof Integer || limit instanceof Long))
            throw new AccountError(400, "payload_invalid");
        return AccountAuthWs.ok(
                admin.entitlement(
                        auth(),
                        csrf.require(requests.get()),
                        AdminService.id(id),
                        new AdminService.Entitlement(
                                (String) body.get("offer"),
                                limit == null ? null : ((Number) limit).longValue(),
                                version(body),
                                reason(body),
                                true)));
    }

    @POST
    @Path("/users/{id}/suspension")
    public Response suspension(@PathParam("id") String id, Map<String, Object> body) {
        query();
        if (body == null
                || !body.keySet()
                        .equals(
                                Set.of(
                                        "suspended",
                                        "confirmation",
                                        "expectedVersion",
                                        "reasonCode"))
                || !(body.get("suspended") instanceof Boolean)
                || !Boolean.TRUE.equals(body.get("confirmation")))
            throw new AccountError(400, "payload_invalid");
        return AccountAuthWs.ok(
                admin.suspension(
                        auth(),
                        csrf.require(requests.get()),
                        AdminService.id(id),
                        new SuspensionInput(
                                (Boolean) body.get("suspended"),
                                version(body),
                                reason(body),
                                true)));
    }

    @GET
    @Path("/queue")
    public Response queue() {
        return AccountAuthWs.ok(admin.queue(auth()));
    }

    @GET
    @Path("/run-options")
    public Response runOptions(@QueryParam("kind") String kind, @QueryParam("q") String search,
            @QueryParam("limit") @DefaultValue("20") int limit, @QueryParam("cursor") String cursor) {
        query("kind", "q", "limit", "cursor");
        return AccountAuthWs.ok(admin.runOptions(auth(), kind, search, limit, cursor));
    }

    @GET
    @Path("/runs")
    public Response runs(
            @QueryParam("user") String user,
            @QueryParam("site") String site,
            @QueryParam("status") String status,
            @QueryParam("from") String from,
            @QueryParam("until") String until,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("cursor") String cursor) {
        query("user", "site", "status", "from", "until", "limit", "cursor");
        return AccountAuthWs.ok(admin.runs(auth(), user, site, status, from, until, limit, cursor));
    }

    @GET
    @Path("/runs/{id}")
    public Response run(@PathParam("id") String id) {
        return AccountAuthWs.ok(admin.run(auth(), AdminService.id(id)));
    }

    @GET
    @Path("/runs/{id}/report")
    public Response report(@PathParam("id") String id) {
        return AccountAuthWs.ok(admin.report(auth(), AdminService.id(id)));
    }

    @GET
    @Path("/users/{id}/events")
    public Response userEvents(
            @PathParam("id") String id,
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("cursor") String cursor) {
        query("limit", "cursor");
        admin.user(auth(), AdminService.id(id));
        return AccountAuthWs.ok(admin.events(auth(), limit, cursor, id));
    }

    @GET
    @Path("/events")
    public Response events(
            @QueryParam("limit") @DefaultValue("20") int limit,
            @QueryParam("cursor") String cursor,
            @QueryParam("target") String target) {
        query("limit", "cursor", "target");
        return AccountAuthWs.ok(admin.events(auth(), limit, cursor, target));
    }
}
