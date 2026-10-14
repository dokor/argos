package com.dokor.argos.services.domain.audit;
/** Raised only AFTER the cancellation/release transaction has durably committed. */
public final class RunCanceledException extends RuntimeException {
    public RunCanceledException() { super("Run canceled"); }
}
