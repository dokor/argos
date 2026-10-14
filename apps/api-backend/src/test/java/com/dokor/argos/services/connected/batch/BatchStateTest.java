package com.dokor.argos.services.connected.batch;

import static org.junit.jupiter.api.Assertions.*;

import com.dokor.argos.services.connected.contract.ConnectedContracts.BatchStatus;

import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.*;

class BatchStateTest {
    static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");

    BatchState.Page page(long id, String status, String completeness, String credit) {
        return new BatchState.Page(
                id,
                id,
                id,
                "https://example.com/" + id,
                status,
                completeness,
                credit,
                false,
                NOW,
                status.equals("QUEUED") ? null : NOW,
                Set.of("COMPLETED", "FAILED", "CANCELED").contains(status) ? NOW : null);
    }

    @Test
    void queuedAndRunningAreNotTerminal() {
        var p = page(1, "QUEUED", "NONE", "RESERVED");
        assertEquals(
                BatchStatus.QUEUED, BatchState.from(List.of(p), 1, false, false, NOW).status());
        assertEquals(
                BatchStatus.RUNNING, BatchState.from(List.of(p), 1, false, true, NOW).status());
        var active =
                BatchState.from(
                        List.of(page(2, "RUNNING", "NONE", "RESERVED"), p), 2, true, false, NOW);
        assertEquals(BatchStatus.RUNNING, active.status());
        assertNull(active.finishedAt());
        assertEquals(2, active.credits().reserved());
    }

    @Test
    void mixedResultsPartitionExecutionEvidenceAndCredits() {
        var s =
                BatchState.from(
                        List.of(
                                page(1, "COMPLETED", "FULL", "COUNTED"),
                                page(2, "COMPLETED", "PARTIAL", "COUNTED"),
                                page(3, "FAILED", "NONE", "RELEASED")),
                        3,
                        false,
                        true,
                        NOW);
        assertEquals(BatchStatus.PARTIAL, s.status());
        assertEquals(2, s.counts().completed());
        assertEquals(1, s.counts().full());
        assertEquals(1, s.counts().partial());
        assertEquals(1, s.counts().failed());
        assertEquals(2, s.credits().counted());
        assertEquals(1, s.credits().released());
        assertEquals(NOW, s.finishedAt());
    }

    @Test
    void terminalMeaningDependsOnEvidenceAndCancellation() {
        assertEquals(
                BatchStatus.COMPLETED,
                BatchState.from(
                                List.of(page(1, "COMPLETED", "FULL", "COUNTED")),
                                1,
                                true,
                                true,
                                NOW)
                        .status());
        assertEquals(
                BatchStatus.PARTIAL,
                BatchState.from(
                                List.of(page(1, "COMPLETED", "UNKNOWN", "COUNTED")),
                                1,
                                false,
                                true,
                                NOW)
                        .status());
        assertEquals(
                BatchStatus.FAILED,
                BatchState.from(List.of(page(1, "FAILED", "NONE", "RELEASED")), 1, false, true, NOW)
                        .status());
        assertEquals(
                BatchStatus.CANCELED,
                BatchState.from(
                                List.of(page(1, "CANCELED", "NONE", "RELEASED")),
                                1,
                                true,
                                false,
                                NOW)
                        .status());
    }

    @Test
    void missingChildrenNeverLookComplete() {
        assertThrows(
                IllegalStateException.class,
                () -> BatchState.from(List.of(), 1, false, false, NOW));
    }
}
