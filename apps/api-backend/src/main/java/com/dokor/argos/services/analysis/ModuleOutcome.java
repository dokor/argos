package com.dokor.argos.services.analysis;

/**
 * Common collection contract translated by AuditProcessorService into report/live statuses.
 * COMPLETED is a successful collection; PARTIAL (data.partial=true) retains only measured
 * checks and lowers report completeness. Both terminate live progress as COMPLETED.
 * UNAVAILABLE means no usable measurements (including null and ModuleUnavailableException),
 * TIMEOUT means the collection deadline expired, and FAILED means an unexpected error.
 * These three states terminate live progress as FAILED and receive one non-scoring collect check.
 */
public enum ModuleOutcome {
    COMPLETED, PARTIAL, UNAVAILABLE, TIMEOUT, FAILED;

    public String liveStatus() {
        return this == COMPLETED || this == PARTIAL ? "COMPLETED" : "FAILED";
    }
}
