package com.dokor.argos.webservices.api.audits;

import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.domain.audit.AuditQueryService;
import com.dokor.argos.services.domain.audit.AuditService;
import com.dokor.argos.webservices.api.audits.data.AuditHistoryItemResponse;
import com.dokor.argos.webservices.api.audits.data.AuditListItemResponse;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
import com.dokor.argos.webservices.api.audits.data.CreateAuditResponse;

/** REST representation mapping stays at the HTTP boundary. */
final class AuditResponseMapper {
    private static final String REPORTS_BASE_PATH = "/dashboard/report/";

    private AuditResponseMapper() {}

    static CreateAuditResponse created(AuditService.CreatedAudit result) {
        return new CreateAuditResponse(result.runId(), result.auditId(), result.status(),
            result.createdAt(), result.reportToken());
    }

    static AuditListItemResponse overview(AuditQueryService.Overview row) {
        var data = row.row();
        return new AuditListItemResponse(data.auditId(), data.hostname(),
            data.inputUrl(), data.normalizedUrl(),
            data.runId() == null ? 0L : data.runId(),
            data.status() == null ? "NO_RUN" : data.status(),
            data.runCreatedAt() == null ? data.auditCreatedAt() : data.runCreatedAt(),
            data.finishedAt(),
            data.hasReport() && data.runId() != null ? REPORTS_BASE_PATH + data.runId() : null,
            data.globalScore());
    }

    static AuditHistoryItemResponse history(AuditQueryService.History row) {
        var data = row.row();
        return new AuditHistoryItemResponse(data.runId(), data.status(),
            data.createdAt(), data.finishedAt(),
            data.hasReport() ? REPORTS_BASE_PATH + data.runId() : null,
            data.globalScore(), null, null, null);
    }

    static AuditRunStatusResponse status(AuditRun run) {
        return new AuditRunStatusResponse(run.getId(), run.getAuditId(), run.getStatus(),
            run.getCreatedAt(), run.getStartedAt(), run.getFinishedAt(), run.getLastError(),
            run.getResultJson(), run.getModuleStatuses());
    }
}
