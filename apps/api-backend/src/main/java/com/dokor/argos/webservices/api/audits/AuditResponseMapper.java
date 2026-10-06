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
        AuditRun run = row.run();
        return new AuditListItemResponse(row.audit().getId(),
            row.domain() == null ? null : row.domain().getHostname(),
            row.audit().getInputUrl(), row.audit().getNormalizedUrl(),
            run == null ? 0L : run.getId(),
            run == null ? "NO_RUN" : run.getStatus(),
            run == null ? row.audit().getCreatedAt() : run.getCreatedAt(),
            run == null ? null : run.getFinishedAt(),
            row.hasReport() && run != null ? REPORTS_BASE_PATH + run.getId() : null,
            run == null ? null : run.getResultJson());
    }

    static AuditHistoryItemResponse history(AuditQueryService.History row) {
        AuditRun run = row.run();
        return new AuditHistoryItemResponse(run.getId(), run.getStatus(),
            run.getCreatedAt(), run.getFinishedAt(),
            row.hasReport() ? REPORTS_BASE_PATH + run.getId() : null,
            row.globalScore(), row.calculation(), row.coverage(), row.comparison());
    }

    static AuditRunStatusResponse status(AuditRun run) {
        return new AuditRunStatusResponse(run.getId(), run.getAuditId(), run.getStatus(),
            run.getCreatedAt(), run.getStartedAt(), run.getFinishedAt(), run.getLastError(),
            run.getResultJson(), run.getModuleStatuses());
    }
}
