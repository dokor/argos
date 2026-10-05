package com.dokor.argos.services.domain.audit.model;

import com.dokor.argos.db.generated.AuditRun;
import com.fasterxml.jackson.annotation.JsonIgnore;

/** Creation-only handoff: the persisted entity contains only the credential hash. */
public record QueuedRun(AuditRun run, @JsonIgnore String reportToken) {
    @Override public String toString() { return "QueuedRun[runId=" + run.getId() + "]"; }
}
