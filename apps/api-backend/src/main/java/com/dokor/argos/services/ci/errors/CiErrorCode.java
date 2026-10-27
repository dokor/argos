package com.dokor.argos.services.ci.errors;

import java.util.Locale;

/** Controlled protocol values. Never derive a public diagnostic from an exception message. */
public enum CiErrorCode {
    REQUEST_REJECTED(403, Stage.AUTHENTICATION, Category.PERMISSION, Action.RELOAD_ACCOUNT, Recovery.NONE),
    REAUTHENTICATION_REQUIRED(403, Stage.AUTHENTICATION, Category.PERMISSION, Action.REAUTHENTICATE_ACCOUNT, Recovery.NONE),
    CONFIG_INVALID(400, Stage.CONFIGURATION, Category.CONFIGURATION, Action.FIX_CONFIGURATION, Recovery.NONE),
    CLIENT_VERSION_UNSUPPORTED(400, Stage.CONFIGURATION, Category.CONFIGURATION, Action.UPDATE_CLIENT, Recovery.NONE),
    AUTHENTICATION_FAILED(401, Stage.AUTHENTICATION, Category.AUTHENTICATION, Action.CHECK_ARGOS_SECRET, Recovery.NONE),
    FEATURE_NOT_AVAILABLE(403, Stage.ENTITLEMENT, Category.PERMISSION, Action.REVIEW_PREMIUM_ACCESS, Recovery.NONE),
    PERMISSION_DENIED(403, Stage.AUTHENTICATION, Category.PERMISSION, Action.REVIEW_KEY_SCOPES, Recovery.NONE),
    RESOURCE_NOT_AVAILABLE(404, Stage.WAIT, Category.RESOURCE, Action.CHECK_OWN_RESOURCE, Recovery.NONE),
    TARGET_VERIFICATION_REQUIRED(403, Stage.TARGET, Category.TARGET, Action.VERIFY_TARGET, Recovery.NONE),
    TARGET_REJECTED(400, Stage.TARGET, Category.TARGET, Action.REVIEW_TARGET_RULES, Recovery.NONE),
    QUOTA_EXCEEDED(429, Stage.ADMISSION, Category.LIMIT, Action.REVIEW_USAGE, Recovery.NONE),
    RATE_LIMITED(429, Stage.ADMISSION, Category.LIMIT, Action.WAIT_WITHIN_BUDGET, Recovery.RETRY_READ),
    CAPACITY_UNAVAILABLE(503, Stage.ADMISSION, Category.AVAILABILITY, Action.WAIT_WITHIN_BUDGET, Recovery.RECOVER_ADMISSION),
    IDEMPOTENCY_CONFLICT(409, Stage.ADMISSION, Category.CONFLICT, Action.RECOVER_ORIGINAL_REQUEST, Recovery.NONE),
    TRANSPORT_FAILED(502, Stage.WAIT, Category.AVAILABILITY, Action.RECOVER_ORIGINAL_REQUEST, Recovery.RECOVER_ADMISSION),
    UPSTREAM_UNAVAILABLE(503, Stage.COLLECTION, Category.AVAILABILITY, Action.RECOVER_ORIGINAL_REQUEST, Recovery.RECOVER_ADMISSION),
    WAIT_TIMEOUT(504, Stage.WAIT, Category.AVAILABILITY, Action.RESUME_EXISTING_RUN, Recovery.RESUME_POLLING),
    RUN_FAILED(422, Stage.COLLECTION, Category.MEASUREMENT, Action.REVIEW_MEASUREMENT, Recovery.NONE),
    MEASUREMENT_INCOMPLETE(422, Stage.VERDICT, Category.MEASUREMENT, Action.REVIEW_MEASUREMENT, Recovery.NONE),
    REPORTS_INCOMPARABLE(422, Stage.VERDICT, Category.MEASUREMENT, Action.REVIEW_MEASUREMENT, Recovery.NONE),
    PUBLICATION_AUTH_FAILED(401, Stage.PUBLICATION, Category.PUBLICATION, Action.CHECK_GIT_SECRET, Recovery.NONE),
    DESTINATION_UNAVAILABLE(404, Stage.PUBLICATION, Category.PUBLICATION, Action.CHECK_OWN_DESTINATION, Recovery.NONE),
    PUBLICATION_RATE_LIMITED(429, Stage.PUBLICATION, Category.PUBLICATION, Action.RESUME_PUBLICATION, Recovery.RETRY_PUBLICATION),
    PUBLICATION_STATE_UNKNOWN(502, Stage.PUBLICATION, Category.PUBLICATION, Action.RECONCILE_PUBLICATION, Recovery.RECONCILE_PUBLICATION),
    ARTIFACT_INVALID(422, Stage.PUBLICATION, Category.PUBLICATION, Action.VERIFY_ARTIFACT, Recovery.NONE),
    INTERNAL_ERROR(500, Stage.WAIT, Category.INTERNAL, Action.RECOVER_ORIGINAL_REQUEST, Recovery.RECOVER_ADMISSION);

    public enum Stage { CONFIGURATION, AUTHENTICATION, ENTITLEMENT, TARGET, ADMISSION, WAIT, COLLECTION, VERDICT, PUBLICATION }
    public enum Category { CONFIGURATION, AUTHENTICATION, PERMISSION, RESOURCE, TARGET, LIMIT, AVAILABILITY, CONFLICT, MEASUREMENT, PUBLICATION, INTERNAL }
    public enum Action { RELOAD_ACCOUNT, REAUTHENTICATE_ACCOUNT, FIX_CONFIGURATION, UPDATE_CLIENT, CHECK_ARGOS_SECRET, REVIEW_PREMIUM_ACCESS,
        REVIEW_KEY_SCOPES, CHECK_OWN_RESOURCE, VERIFY_TARGET, REVIEW_TARGET_RULES, REVIEW_USAGE,
        WAIT_WITHIN_BUDGET, RECOVER_ORIGINAL_REQUEST, RESUME_EXISTING_RUN, REVIEW_MEASUREMENT,
        CHECK_GIT_SECRET, CHECK_OWN_DESTINATION, RESUME_PUBLICATION, RECONCILE_PUBLICATION, VERIFY_ARTIFACT }
    /** A recovery instruction is never permission to repeat a mutating POST blindly. */
    public enum Recovery { NONE, RETRY_READ, RECOVER_ADMISSION, RESUME_POLLING, RETRY_PUBLICATION, RECONCILE_PUBLICATION }

    private final int httpStatus;
    private final Stage stage;
    private final Category category;
    private final Action action;
    private final Recovery recovery;
    CiErrorCode(int httpStatus, Stage stage, Category category, Action action, Recovery recovery) {
        this.httpStatus = httpStatus; this.stage = stage; this.category = category;
        this.action = action; this.recovery = recovery;
    }
    public int httpStatus() { return httpStatus; }
    public Stage stage() { return stage; }
    public Category category() { return category; }
    public Action action() { return action; }
    public Recovery recovery() { return recovery; }
    public boolean retryable() { return recovery != Recovery.NONE; }
    public boolean acceptsRetryAfter() {
        return this == QUOTA_EXCEEDED || this == RATE_LIMITED || this == CAPACITY_UNAVAILABLE
            || this == UPSTREAM_UNAVAILABLE || this == PUBLICATION_RATE_LIMITED;
    }
    public String messageKey() { return "ci.errors." + name(); }
    /** Reserved public documentation paths; published by #742, no user input or query parameters. */
    public String documentationPath(boolean english) {
        return (english ? "/en/docs/errors#" : "/docs/errors#") + name().toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
