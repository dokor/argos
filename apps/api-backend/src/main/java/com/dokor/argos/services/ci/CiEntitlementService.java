package com.dokor.argos.services.ci;

import com.dokor.argos.services.account.UsageService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Clock;

/** Internal guard, not authentication. Call only after resolving a credential's owner server-side. */
@Singleton
public final class CiEntitlementService {
    /** Domain decisions are translated by the CI error boundary, never serialized directly. */
    public enum Denial { ACCOUNT_INACCESSIBLE, FEATURE_NOT_AVAILABLE }
    public static final class Denied extends RuntimeException {
        private final Denial reason;
        private Denied(Denial reason) { super(reason.name()); this.reason = reason; }
        public Denial reason() { return reason; }
    }
    private final CiPolicy policy;
    private final UsageService usage;
    private final Clock clock;

    @Inject public CiEntitlementService(CiPolicy policy, UsageService usage, Clock clock) {
        this.policy = policy; this.usage = usage; this.clock = clock;
    }

    /**
     * Locks account then entitlement until the caller commits key creation or admission.
     * This is a current read even if an earlier MVCC read saw an old subscription.
     * Entitlement writers (#733) must use the same account -> entitlement lock order.
     */
    public CiPolicy.Limits requireNewAccess(long authenticatedOwner, Connection c) {
        requireTransaction(c);
        try (var s = c.prepareStatement("SELECT state,offer FROM ARG_ACCOUNT_USER WHERE id=? FOR UPDATE")) {
            s.setLong(1, authenticatedOwner);
            try (var r = s.executeQuery()) {
                if (!r.next() || !"ACTIVE".equals(r.getString(1)))
                    throw new Denied(Denial.ACCOUNT_INACCESSIBLE);
                if (!"PREMIUM".equals(r.getString(2))) throw new Denied(Denial.FEATURE_NOT_AVAILABLE);
            }
        } catch (SQLException e) { throw new IllegalStateException("CI account unavailable", e); }
        var limits = policy.limits().orElseThrow(() -> new Denied(Denial.FEATURE_NOT_AVAILABLE));
        try (var s = c.prepareStatement("SELECT ci_access,valid_until FROM ARG_ACCOUNT_CI_ENTITLEMENT WHERE id=? FOR UPDATE")) {
            s.setLong(1, authenticatedOwner);
            try (var r = s.executeQuery()) {
                if (!r.next() || !r.getBoolean(1) || r.getTimestamp(2) == null
                        || !r.getTimestamp(2).toInstant().isAfter(clock.instant()))
                    throw new Denied(Denial.FEATURE_NOT_AVAILABLE);
            }
        } catch (SQLException e) { throw new IllegalStateException("CI entitlement unavailable", e); }
        return limits;
    }

    /**
     * Precheck N analyses on the shared ledger, before ANY child is inserted.
     * The caller inserts all runs/reservations on this connection or rolls back everything.
     * Matching idempotent admissions must be recovered before this check (no new work).
     */
    public CiPolicy.Limits admitMany(long authenticatedOwner, int analyses, Connection c) {
        if (analyses < 1 || analyses > 2) throw new IllegalArgumentException("CI measurement count must be 1 or 2");
        var limits = requireNewAccess(authenticatedOwner, c);
        usage.admitMany(authenticatedOwner, analyses, c);
        return limits;
    }

    private static void requireTransaction(Connection c) {
        try {
            if (c.getAutoCommit()) throw new IllegalStateException("CI entitlement requires a transaction");
        } catch (SQLException e) { throw new IllegalStateException("CI transaction unavailable", e); }
    }
}
