package com.dokor.argos.services.domain.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

/** Execution progress is distinct from successful collection and scoring coverage. */
public record ModuleExecution(int total, int completed, int partial, int failed, int skipped,
                              int pending, int running, int terminalPercent) {
    public static ModuleExecution from(Map<String, String> meta) {
        if (meta == null || meta.get("moduleStatuses") == null) return null;
        try {
            var states = new ObjectMapper().readTree(meta.get("moduleStatuses"));
            if (!states.isObject() || states.isEmpty() || states.size() > 32) return null;
            int completed=0, partial=0, failed=0, skipped=0, pending=0, running=0;
            for (var state : states) {
                if (!state.isTextual()) return null;
                switch (state.asText()) {
                    case "COMPLETED" -> completed++;
                    case "PARTIAL" -> partial++;
                    case "FAILED", "UNAVAILABLE", "TIMEOUT" -> failed++;
                    case "SKIPPED" -> skipped++;
                    case "PENDING" -> pending++;
                    case "RUNNING" -> running++;
                    default -> { return null; }
                }
            }
            int total=states.size();
            return new ModuleExecution(total, completed, partial, failed, skipped, pending, running,
                (int)Math.round(100.0*(completed+partial+failed+skipped)/total));
        } catch (java.io.IOException ignored) { return null; }
    }
}
