package com.dokor.argos.services.account;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

import java.util.Map;

public class AccountError extends WebApplicationException {
    public AccountError(int status, String code) {
        this(status, code, null);
    }

    public AccountError(int status, String code, Integer retryAfterSeconds) {
        super(
                Response.status(status)
                        .type(jakarta.ws.rs.core.MediaType.APPLICATION_JSON)
                        .header("Cache-Control", "private, no-store")
                        .header("Retry-After", retryAfterSeconds)
                        .entity(Map.of("error", code))
                        .build());
    }

    public static AccountError unauthorized() {
        return new AccountError(401, "session_invalid");
    }

    public static AccountError forbidden(String code) {
        return new AccountError(403, code);
    }

    public static AccountError missing() {
        return new AccountError(404, "resource_unavailable");
    }
}
