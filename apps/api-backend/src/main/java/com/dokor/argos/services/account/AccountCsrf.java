package com.dokor.argos.services.account;

import jakarta.inject.*;
import jakarta.ws.rs.container.ContainerRequestContext;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Singleton
public class AccountCsrf {
    public static final String COOKIE = "argos_account_csrf";
    private final AccountSettings settings;

    @Inject
    public AccountCsrf(AccountSettings settings) {
        this.settings = settings;
    }

    public String require(ContainerRequestContext request) {
        String origin = request.getHeaderString("Origin"),
                header = request.getHeaderString("X-Argos-CSRF");
        var cookie = request.getCookies().get(COOKIE);
        if (!settings.origin().equals(origin)
                || cookie == null
                || !valid(header)
                || !same(header, cookie.getValue())) throw AccountError.forbidden("csrf_invalid");
        return header;
    }

    public static boolean valid(String token) {
        return token != null && token.matches("[A-Za-z0-9_-]{43}");
    }

    public static boolean same(String a, String b) {
        return a != null
                && b != null
                && MessageDigest.isEqual(
                        a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
