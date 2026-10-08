package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.analysis.scoring.MeasurementCoverage;
import com.dokor.argos.services.domain.audit.errors.NotFoundException;
import com.dokor.argos.services.domain.report.AuditComparisonService;
import com.dokor.argos.services.domain.report.ReportDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.util.List;

/** Read model for admin audit lists, history and run status. No REST DTOs leave this layer. */
@Singleton
public class AuditQueryService {
    private final AuditDao audits;
    private final AuditRunService runs;
    private final ObjectMapper mapper;

    @Inject
    public AuditQueryService(AuditDao audits, AuditRunService runs, ObjectMapper mapper) {
        this.audits = audits;
        this.runs = runs;
        this.mapper = mapper;
    }

    public record Overview(AuditDao.OverviewRow row) {}
    public record History(AuditDao.HistoryRow row) {}
    public record ComparisonDetail(ReportDto.ScoreCalculation calculation, MeasurementCoverage coverage,
                                   AuditComparisonService.Comparison comparison) {}

    public List<Overview> listAudits(int limit) {
        return audits.listAuditsWithLatestRun(limit).stream().map(Overview::new).toList();
    }

    public List<History> getAuditHistory(long auditId, int limit) {
        return audits.listRunsWithReportByAuditId(auditId, limit).stream().map(History::new).toList();
    }

    /** Expensive evidence is loaded only for the comparison the admin opens. */
    public ComparisonDetail getComparisonDetail(long auditId, long runId) {
        List<AuditReport> reports = audits.comparisonReports(auditId, runId);
        if (reports.isEmpty() || !Long.valueOf(runId).equals(reports.getFirst().getRunId())) {
            throw new NotFoundException("Published report not found for run: " + runId);
        }
        ReportDto current = parseReport(reports.getFirst());
        ReportDto previous = reports.size() > 1 ? parseReport(reports.get(1)) : null;
        ReportDto.Scores scores = current == null ? null : current.scores();
        return new ComparisonDetail(scores == null ? null : scores.calculation(),
            scores == null ? null : scores.coverage(), AuditComparisonService.compare(previous, current));
    }

    public AuditRun getRunStatus(long runId) {
        return runs.getRun(runId)
            .orElseThrow(() -> new NotFoundException("AuditRun not found: " + runId));
    }

    private ReportDto parseReport(AuditReport report) {
        if (report == null || report.getReportJson() == null || report.getReportJson().isBlank()) return null;
        try {
            return mapper.readValue(report.getReportJson(), ReportDto.class);
        } catch (Exception malformed) {
            return null;
        }
    }
}
