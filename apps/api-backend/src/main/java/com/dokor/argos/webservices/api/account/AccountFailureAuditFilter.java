package com.dokor.argos.webservices.api.account;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.services.account.AccountSessionService;

import jakarta.inject.*;
import jakarta.ws.rs.container.*;
import jakarta.ws.rs.ext.Provider;

/** Fixed action only; never record URI, query, payload, credential, email or exception. */
@Provider
@Singleton
public class AccountFailureAuditFilter implements ContainerResponseFilter {
    private final AccountDao dao;
    private final AccountSessionService sessions;

    @Inject
    public AccountFailureAuditFilter(AccountDao dao, AccountSessionService sessions) {
        this.dao = dao;
        this.sessions = sessions;
    }

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        if (!request.getUriInfo().getPath().startsWith("account")) return;
        response.getHeaders().putSingle("Cache-Control", "private, no-store");
        if (response.getStatus() < 400) return;
        var context =
                (AccountSessionService.Context)
                        request.getProperty(AccountSessionService.Context.class.getName());
        try {
            dao.transaction(
                    c -> {
                        sessions.event(
                                "request_refused",
                                "denied",
                                context == null ? null : context.user().getId(),
                                context == null ? null : context.session().getId(),
                                c);
                        return null;
                    });
        } catch (RuntimeException unavailable) {
            /* Do not disclose errors or alter the original refusal. */
        }
    }
}
