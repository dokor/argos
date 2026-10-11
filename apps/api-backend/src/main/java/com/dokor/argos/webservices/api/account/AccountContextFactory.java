package com.dokor.argos.webservices.api.account;

import com.dokor.argos.services.account.AccountSessionService;

import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;

import org.glassfish.hk2.api.Factory;
import org.glassfish.hk2.utilities.binding.AbstractBinder;
import org.glassfish.jersey.process.internal.RequestScoped;

/** Argos adaptation of Plume's request factory, with current registry authorization. */
public class AccountContextFactory implements Factory<AccountSessionService.Context> {
    private final ContainerRequestContext request;
    private final AccountSessionService sessions;

    @Inject
    public AccountContextFactory(
            @Context ContainerRequestContext request, AccountSessionService sessions) {
        this.request = request;
        this.sessions = sessions;
    }

    @Override
    public AccountSessionService.Context provide() {
        return sessions.with(
                request.getHeaderString("Authorization"),
                null,
                false,
                true,
                (context, connection) -> context);
    }

    @Override
    public void dispose(AccountSessionService.Context context) {}

    public static AbstractBinder binding(AccountSessionService sessions) {
        return new AbstractBinder() {
            @Override
            protected void configure() {
                bind(sessions).to(AccountSessionService.class);
                bindFactory(AccountContextFactory.class)
                        .to(AccountSessionService.Context.class)
                        .in(RequestScoped.class);
            }
        };
    }
}
