package com.dokor.argos.services.analysis;

import java.net.*;
import java.net.http.HttpTimeoutException;
import javax.net.ssl.SSLException;

/** Bounded diagnostic vocabulary: never inspect or publish upstream bodies/messages. */
public final class CollectorFailure extends IllegalStateException {
    public enum Code {
        POLICY_DISABLED, PROVIDER_RATE_LIMITED, PROVIDER_AUTH_REQUIRED, PROVIDER_UNAVAILABLE,
        INTEGRATION_ENDPOINT, NETWORK_DNS, NETWORK_CONNECT, NETWORK_TLS, DEADLINE_EXCEEDED,
        TARGET_ASSESSMENT_FAILED, INVALID_RESPONSE, INCOMPLETE_MEASUREMENTS, INTEGRATION_FAILURE
    }
    private final Code code;
    public CollectorFailure(Code code) { super(code.name()); this.code = code; }
    public static Code classify(Throwable failure) {
        Code network = Code.INTEGRATION_FAILURE;
        for (int depth = 0; failure != null && depth < 12; depth++, failure = failure.getCause()) {
            if (failure instanceof CollectorFailure known) return known.code;
            if (failure instanceof HttpTimeoutException || failure instanceof AuditDeadline.DeadlineExceeded) return Code.DEADLINE_EXCEEDED;
            if (failure instanceof ExternalHttpClient.HttpStatusException status) return switch (status.statusCode()) {
                case 401, 403 -> Code.PROVIDER_AUTH_REQUIRED;
                case 422 -> Code.TARGET_ASSESSMENT_FAILED;
                case 429 -> Code.PROVIDER_RATE_LIMITED;
                case 404, 410, 301, 302, 307, 308 -> Code.INTEGRATION_ENDPOINT;
                default -> Code.PROVIDER_UNAVAILABLE;
            };
            if (failure instanceof UnknownHostException || failure instanceof java.nio.channels.UnresolvedAddressException) return Code.NETWORK_DNS;
            if (failure instanceof SSLException) return Code.NETWORK_TLS;
            if (failure instanceof ConnectException) network = Code.NETWORK_CONNECT;
        }
        return network;
    }
}
