package com.dokor.argos.services.connected.batch;

import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

import java.time.Instant;
import java.util.*;

/** Execution, evidence completeness and credits are separate dimensions. */
public final class BatchState {
    private BatchState() {}

    public record Page(
            long id,
            long discoveryPageId,
            long runId,
            String url,
            String status,
            String completeness,
            String credit,
            boolean reportAvailable,
            Instant createdAt,
            Instant startedAt,
            Instant finishedAt) {}

    public record Snapshot(
            BatchStatus status,
            BatchExecutionCounts counts,
            BatchCredits credits,
            Instant finishedAt,
            String signature) {}

    public static Snapshot from(
            List<Page> pages,
            int selected,
            boolean cancelRequested,
            boolean alreadyStarted,
            Instant now) {
        if (pages.size() != selected || selected < 1 || selected > 50)
            throw new IllegalStateException("Batch children inconsistent");
        long queued = 0,
                running = 0,
                completed = 0,
                failed = 0,
                canceled = 0,
                full = 0,
                partial = 0,
                unknown = 0,
                reserved = 0,
                counted = 0,
                released = 0;
        boolean started = alreadyStarted;
        Instant finished = null;
        var signature = new StringBuilder();
        for (var p : pages) {
            switch (p.status) {
                case "QUEUED" -> queued++;
                case "RUNNING" -> running++;
                case "COMPLETED" -> completed++;
                case "FAILED" -> failed++;
                case "CANCELED" -> canceled++;
                default -> throw new IllegalStateException("Batch execution invalid");
            }
            if (p.status.equals("COMPLETED"))
                switch (p.completeness) {
                    case "FULL" -> full++;
                    case "PARTIAL" -> partial++;
                    default -> unknown++;
                }
            switch (p.credit) {
                case "RESERVED" -> reserved++;
                case "COUNTED" -> counted++;
                case "RELEASED" -> released++;
                default -> throw new IllegalStateException("Batch credit missing");
            }
            started |= p.startedAt != null || !p.status.equals("QUEUED");
            if (p.finishedAt != null && (finished == null || finished.isBefore(p.finishedAt)))
                finished = p.finishedAt;
            signature
                    .append(p.runId)
                    .append(':')
                    .append(p.status)
                    .append(':')
                    .append(p.completeness)
                    .append(':')
                    .append(p.credit)
                    .append(';');
        }
        BatchStatus status;
        if (queued + running > 0) {
            status = started ? BatchStatus.RUNNING : BatchStatus.QUEUED;
            finished = null;
        } else {
            status =
                    cancelRequested && canceled > 0
                            ? BatchStatus.CANCELED
                            : full == selected
                                    ? BatchStatus.COMPLETED
                                    : failed == selected ? BatchStatus.FAILED : BatchStatus.PARTIAL;
            if (finished == null) finished = now;
        }
        return new Snapshot(
                status,
                new BatchExecutionCounts(
                        (long) selected,
                        queued,
                        running,
                        completed,
                        failed,
                        canceled,
                        full,
                        partial,
                        unknown),
                new BatchCredits((long) selected, reserved, counted, released),
                finished,
                signature.toString());
    }
}
