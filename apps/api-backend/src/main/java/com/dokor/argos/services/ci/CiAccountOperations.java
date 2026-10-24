package com.dokor.argos.services.ci;

import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.errors.*;
import jakarta.inject.*;
import jakarta.ws.rs.WebApplicationException;
import java.sql.Connection;
import java.util.Map;
import java.util.function.BiFunction;

/** Browser management only: existing verified session, CSRF and recent authentication. */
@Singleton
public class CiAccountOperations {
    private static final org.slf4j.Logger logger=org.slf4j.LoggerFactory.getLogger(CiAccountOperations.class);
    private final AccountSessionService sessions;
    private final AccountRateLimiter rate;
    private final CiEntitlementService entitlement;
    @Inject public CiAccountOperations(AccountSessionService sessions, AccountRateLimiter rate, CiEntitlementService entitlement) {
        this.sessions=sessions; this.rate=rate; this.entitlement=entitlement;
    }
    public <T> T read(String auth, BiFunction<AccountSessionService.Context,Connection,T> work) {
        return boundary(() -> sessions.with(auth,null,true,false,work));
    }
    public <T> T change(String auth, String csrf, boolean newAccess, String action, String remote,
                       BiFunction<AccountSessionService.Context,Connection,T> work) {
        return boundary(() -> {
            if (!AccountCsrf.valid(csrf)) throw fail(CiErrorCode.REQUEST_REJECTED);
            var owner=sessions.with(auth,csrf,true,false,(ctx,c) -> {
                sessions.recent(ctx);
                if(newAccess) entitlement.requireNewAccess(ctx.user().getId(),c);
                return ctx.user().getId();
            });
            // Separate commit: failed mutations must still consume the anti-abuse budget.
            rate.check(action,owner.toString(),remote);
            return sessions.with(auth,csrf,true,true,(ctx,c) -> {
                sessions.recent(ctx);
                if (newAccess) entitlement.requireNewAccess(ctx.user().getId(),c);
                return work.apply(ctx,c);
            });
        });
    }
    public static WebApplicationException fail(CiErrorCode code) {
        var response=CiErrors.response(code,null);
        if(code==CiErrorCode.INTERNAL_ERROR) logger.error("ci_operation_failed requestId={} category=internal",
            ((CiErrors.Envelope)response.getEntity()).requestId());
        return new WebApplicationException(response);
    }
    public static <T> T boundary(java.util.function.Supplier<T> work) {
        try { return work.get(); }
        catch (CiEntitlementService.Denied denied) { throw fail(CiErrors.entitlementCode(denied.reason())); }
        catch (AccountError error) {
            String code = error.getResponse().getEntity() instanceof Map<?,?> values ? String.valueOf(values.get("error")) : "";
            throw fail(error.getResponse().getStatus()==401 ? CiErrorCode.AUTHENTICATION_FAILED
                : error.getResponse().getStatus()>=500 ? CiErrorCode.UPSTREAM_UNAVAILABLE
                : error.getResponse().getStatus()==404 ? CiErrorCode.RESOURCE_NOT_AVAILABLE
                : error.getResponse().getStatus()==400 ? CiErrorCode.CONFIG_INVALID
                : code.equals("reauth_required") ? CiErrorCode.REAUTHENTICATION_REQUIRED
                : code.equals("csrf_invalid") ? CiErrorCode.REQUEST_REJECTED : CiErrorCode.PERMISSION_DENIED);
        }
        catch (WebApplicationException known) {
            if (known.getResponse().getEntity() instanceof CiErrors.Envelope) throw known;
            if (known.getResponse().getStatus()==429) throw new WebApplicationException(CiErrors.response(CiErrorCode.RATE_LIMITED,900L));
            throw fail(CiErrorCode.INTERNAL_ERROR);
        }
        catch (Exception failed) { throw fail(CiErrorCode.INTERNAL_ERROR); }
    }
}
