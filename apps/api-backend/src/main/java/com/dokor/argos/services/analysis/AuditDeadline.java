package com.dokor.argos.services.analysis;

import java.time.Duration;
import java.util.concurrent.Callable;
import java.util.function.LongSupplier;

/** Monotone, shared across requests/polls; scoped explicitly onto module worker threads. */
public final class AuditDeadline {
    private static final ThreadLocal<AuditDeadline> CURRENT = new ThreadLocal<>();
    private final LongSupplier clock;
    private final long started;
    private final long budget;
    private final AuditDeadline root;
    public AuditDeadline(Duration duration) { this(duration,System::nanoTime); }
    AuditDeadline(Duration duration,LongSupplier clock) {
        if(duration.isNegative() || duration.isZero()) throw new IllegalArgumentException("Audit timeout must be positive");
        this.clock=clock; this.started=clock.getAsLong(); this.budget=duration.toNanos(); this.root=this;
    }
    private AuditDeadline(AuditDeadline parent,Duration duration) {
        this.clock=parent.clock; this.started=clock.getAsLong();
        this.budget=Math.max(0,Math.min(parent.remainingNanos(),duration.toNanos())); this.root=parent.root;
    }
    public AuditDeadline child(Duration maximum) { return new AuditDeadline(this,maximum); }
    public AuditDeadline publication() { return root; }
    public long remainingNanos() { return Math.max(0,budget-(clock.getAsLong()-started)); }
    public boolean expired() { return remainingNanos()==0; }
    public Duration remaining(Duration maximum) {
        long left=remainingNanos();
        if(left==0 || Thread.currentThread().isInterrupted()) throw new DeadlineExceeded();
        return Duration.ofNanos(Math.min(left,maximum.toNanos()));
    }
    public static AuditDeadline current() { return CURRENT.get(); }
    public static Duration requestTimeout(Duration maximum) {
        var current=current(); return current==null?maximum:current.remaining(maximum);
    }
    public Scope enter() { var previous=CURRENT.get(); CURRENT.set(this); return () -> { if(previous==null) CURRENT.remove(); else CURRENT.set(previous); }; }
    public <T> T call(Callable<T> action) throws Exception { try(var scope=enter()) { remaining(Duration.ofDays(1)); return action.call(); } }
    public interface Scope extends AutoCloseable { @Override void close(); }
    public static final class DeadlineExceeded extends RuntimeException {
        public DeadlineExceeded() { super("Audit deadline exceeded (timeout)"); }
    }
}
