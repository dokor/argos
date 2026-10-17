package com.dokor.argos.services.account;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class AdminQueueServiceTest {
    private final Instant now = Instant.parse("2026-10-17T10:00:00Z");
    private final Duration timeout = Duration.ofMinutes(20);

    private Map<String, Object> task(String type, String status) {
        var row = new HashMap<String, Object>();
        row.put("type", type); row.put("status", status);
        return row;
    }
    private String diagnostic(Map<String, Object> row) { return AdminQueueService.diagnostic(row, now, timeout); }

    @Test void anOldRunningFlagIsNeverProofOfActivity() {
        var run = task("RUN", "RUNNING");
        assertEquals("INCONSISTENT", diagnostic(run));
        run.put("startedAt", now.minus(timeout).toString());
        assertEquals("OBSERVED", diagnostic(run)); // Same strict threshold as the reaper.
        run.put("startedAt", now.minus(timeout).minusSeconds(1).toString());
        assertEquals("STALE", diagnostic(run));
        run.put("status", "QUEUED"); run.put("startedAt", null); run.put("attempts", 1);
        assertEquals("REQUEUED", diagnostic(run));
        run.put("status", "FAILED");
        assertEquals("TERMINAL", diagnostic(run));
    }

    @Test void discoveryLeaseExpiryAndCancellationUsePersistedEvidence() {
        var discovery = task("DISCOVERY", "RUNNING");
        discovery.put("startedAt", now.minusSeconds(30).toString());
        assertEquals("INCONSISTENT", diagnostic(discovery));
        discovery.put("leaseUntil", now.toString());
        assertEquals("LEASE_EXPIRED", diagnostic(discovery));
        discovery.put("cancelRequested", true);
        assertEquals("CANCEL_REQUESTED", diagnostic(discovery));
        discovery.put("status", "CANCELED");
        assertEquals("TERMINAL", diagnostic(discovery));
        discovery.put("status", "QUEUED"); discovery.put("cancelRequested", false);
        discovery.put("expiresAt", now.toString());
        assertEquals("EXPIRED", diagnostic(discovery));
    }

    @Test void batchDiagnosisComparesCachedStateWithRealChildren() {
        var batch = task("BATCH", "QUEUED");
        batch.put("pageCount", 3); batch.put("childCount", 2);
        assertEquals("INCONSISTENT", diagnostic(batch));
        batch.put("childCount", 3); batch.put("queuedChildren", 3); batch.put("runningChildren", 0);
        assertEquals("OBSERVED", diagnostic(batch));
        batch.put("startedAt", now.minusSeconds(30).toString()); batch.put("queuedChildren", 2); batch.put("runningChildren", 1);
        assertEquals("RECONCILIATION_PENDING", diagnostic(batch));
        batch.put("status", "RUNNING");
        assertEquals("INCONSISTENT", diagnostic(batch));
        batch.put("oldestRunningAt", now.minusSeconds(1300).toString());
        assertEquals("STALE", diagnostic(batch));
        batch.put("runningChildren", 0); batch.put("queuedChildren", 0);
        assertEquals("RECONCILIATION_PENDING", diagnostic(batch));
    }

    @Test void invalidFiltersCannotBecomeSqlOrUnboundedPages() {
        assertThrows(AccountError.class, () -> AdminQueueService.validate(new AdminQueueService.Filters("COMPLETED", null, null, null, null, null, null, 1, 20)));
        assertThrows(AccountError.class, () -> AdminQueueService.validate(new AdminQueueService.Filters(null, null, null, null, null, null, "id;DELETE", 1, 20)));
        assertThrows(AccountError.class, () -> AdminQueueService.validate(new AdminQueueService.Filters(null, null, null, null, "2026-02-30", null, null, 1, 20)));
        assertThrows(AccountError.class, () -> AdminQueueService.validate(new AdminQueueService.Filters(null, null, null, null, "2026-10-17", "2026-10-01", null, 1, 20)));
        assertThrows(AccountError.class, () -> AdminQueueService.validate(new AdminQueueService.Filters(null, null, null, null, null, null, null, 10001, 20)));
        assertDoesNotThrow(() -> AdminQueueService.validate(new AdminQueueService.Filters("RUN", "QUEUED", "www.example.com", "anonymous", "2026-10-17", "2026-10-17", "oldest", 1, 100)));
    }
}
