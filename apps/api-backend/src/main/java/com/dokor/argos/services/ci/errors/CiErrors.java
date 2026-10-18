package com.dokor.argos.services.ci.errors;

import com.dokor.argos.services.ci.CiEntitlementService;
import jakarta.ws.rs.core.Response;
import java.util.Objects;
import java.util.UUID;

/** Factory has no input for raw messages, exception text, URLs or caller-supplied request IDs. */
public final class CiErrors {
    public static final int SCHEMA_VERSION = 1;
    public static final long MAX_RETRY_AFTER_SECONDS = 32L * 24 * 60 * 60;
    public record Error(CiErrorCode code, CiErrorCode.Stage stage, CiErrorCode.Category category,
                        String messageKey, CiErrorCode.Action actionCode, boolean retryable,
                        CiErrorCode.Recovery recovery, Long retryAfterSeconds) {}
    public record Envelope(int schemaVersion, String requestId, Error error) {}
    private CiErrors() {}

    public static Envelope create(CiErrorCode code, Long retryAfterSeconds) {
        Objects.requireNonNull(code);
        if (retryAfterSeconds != null && (!code.acceptsRetryAfter()
                || retryAfterSeconds < 1 || retryAfterSeconds > MAX_RETRY_AFTER_SECONDS))
            throw new IllegalArgumentException("Invalid CI retry delay");
        return new Envelope(SCHEMA_VERSION, UUID.randomUUID().toString(),
            new Error(code, code.stage(), code.category(), code.messageKey(), code.action(),
                code.retryable(), code.recovery(), retryAfterSeconds));
    }

    public static Response response(CiErrorCode code, Long retryAfterSeconds) {
        var envelope = create(code, retryAfterSeconds);
        var response = Response.status(code.httpStatus()).type("application/json")
            .header("Cache-Control", "private, no-store")
            .header("X-Content-Type-Options", "nosniff").entity(envelope);
        if (retryAfterSeconds != null) response.header("Retry-After", retryAfterSeconds);
        return response.build();
    }

    public static CiErrorCode entitlementCode(CiEntitlementService.Denial reason) {
        return switch (Objects.requireNonNull(reason)) {
            case ACCOUNT_INACCESSIBLE -> CiErrorCode.AUTHENTICATION_FAILED;
            case FEATURE_NOT_AVAILABLE -> CiErrorCode.FEATURE_NOT_AVAILABLE;
        };
    }
}
