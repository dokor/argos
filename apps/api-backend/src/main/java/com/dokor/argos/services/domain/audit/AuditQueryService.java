package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.Domain;
import com.dokor.argos.services.analysis.scoring.MeasurementCoverage;
import com.dokor.argos.services.domain.audit.errors.NotFoundException;
import com.dokor.argos.services.domain.report.AuditComparisonService;
import com.dokor.argos.services.domain.report.ReportDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.core.Tuple;
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

    public record Overview(Audit audit, Domain domain, AuditRun run, boolean hasReport) {}
    public record History(AuditRun run, boolean hasReport, Integer globalScore,
                          ReportDto.ScoreCalculation calculation, MeasurementCoverage coverage,
                          AuditComparisonService.Comparison comparison) {}
    private record ParsedReport(ReportDto dto, Integer globalScore) {}

    public List<Overview> listAudits(int limit) {
        return audits.listAuditsWithLatestRun(limit).stream().map(row ->
            new Overview(row.get(0, Audit.class), row.get(1, Domain.class),
                row.get(2, AuditRun.class), row.get(3, AuditReport.class) != null)
        ).toList();
    }

    public List<History> getAuditHistory(long auditId, int limit) {
        List<Tuple> rows = audits.listRunsWithReportByAuditId(auditId, limit);
        // Comparison needs the full report. Parse each report once and reuse its score.
        List<ParsedReport> parsed = rows.stream()
            .map(row -> parseReport(row.get(1, AuditReport.class))).toList();
        return java.util.stream.IntStream.range(0, rows.size()).mapToObj(index -> {
            AuditRun run = rows.get(index).get(0, AuditRun.class);
            AuditReport report = rows.get(index).get(1, AuditReport.class);
            ParsedReport current = parsed.get(index);
            ReportDto previous = null;
            for (int earlier = index + 1; earlier < parsed.size() && previous == null; earlier++) {
                previous = parsed.get(earlier).dto();
            }
            ReportDto.Scores scores = current.dto() == null ? null : current.dto().scores();
            return new History(run, report != null, current.globalScore(),
                scores == null ? null : scores.calculation(),
                scores == null ? null : scores.coverage(),
                report == null ? null : AuditComparisonService.compare(previous, current.dto()));
        }).toList();
    }

    public AuditRun getRunStatus(long runId) {
        return runs.getRun(runId)
            .orElseThrow(() -> new NotFoundException("AuditRun not found: " + runId));
    }

    private ParsedReport parseReport(AuditReport report) {
        if (report == null || report.getReportJson() == null || report.getReportJson().isBlank()) {
            return new ParsedReport(null, null);
        }
        try {
            JsonNode root = mapper.readTree(report.getReportJson());
            Integer score = globalScore(root);
            try {
                return new ParsedReport(mapper.treeToValue(root, ReportDto.class), score);
            } catch (Exception invalidDto) {
                return new ParsedReport(null, score);
            }
        } catch (Exception malformed) {
            return new ParsedReport(null, null);
        }
    }

    static Integer globalScore(JsonNode report) {
        if (report == null) return null;
        JsonNode scores = report.path("scores");
        if (scores.path("globalAvailable").isBoolean() && !scores.path("globalAvailable").asBoolean()) return null;
        JsonNode value = scores.path("global");
        return value.isMissingNode() || value.isNull() ? null : value.asInt();
    }
}
