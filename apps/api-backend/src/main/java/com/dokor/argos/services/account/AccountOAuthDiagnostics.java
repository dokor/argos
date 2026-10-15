package com.dokor.argos.services.account;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Fixed vocabulary only: never pass provider payloads or exception messages to this logger. */
final class AccountOAuthDiagnostics {
    private static final Logger logger = LoggerFactory.getLogger(AccountOAuthDiagnostics.class);

    enum Stage {
        CALLBACK_CONTEXT, TRANSACTION, TOKEN_EXCHANGE, PROVIDER_PROFILE,
        ID_TOKEN_PARSING, ID_TOKEN_VALIDATION, IDENTITY_CLAIMS
    }

    enum Reason {
        INVALID_CONTEXT, INVALID_OR_EXPIRED_TRANSACTION, HTTP_REJECTED, TIMEOUT,
        NETWORK_IO, MALFORMED_RESPONSE, OIDC_REJECTED, UNEXPECTED_RESPONSE
    }

    static void rejected(String provider, Stage stage, Reason reason, int httpStatus) {
        String safeProvider = switch (provider == null ? "" : provider) {
            case "google", "github", "linkedin" -> provider;
            default -> "unknown";
        };
        logger.warn("account_oauth_rejected provider={} stage={} reason={} http_status={}",
                safeProvider, stage, reason, httpStatus >= 100 && httpStatus <= 599 ? httpStatus : 0);
    }

    private AccountOAuthDiagnostics() {}
}
