package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class ReportDiagnosticsTest {
    private AuditCheckResult check(String key, AuditStatus status) {
        return AuditCheckResult.of(key, "Title " + key, status, AuditSeverity.MEDIUM,
            true, 1, List.of("performance"), 1, Map.of(), "Observation", "Correction");
    }

    @Test void separatesSiteFindingsFromUnmeasuredChecksAndDoesNotInferPasses() throws Exception {
        var expected = List.of(
            new MeasurementCoverage.Check("http.status_code", "performance", "http", 1, MeasurementCoverage.State.MEASURED, null, "HIGH"),
            new MeasurementCoverage.Check("runtime.lcp", "performance", "runtime", 1, MeasurementCoverage.State.UNAVAILABLE, "MODULE_FAILED", "UNKNOWN"),
            new MeasurementCoverage.Check("runtime.fcp", "performance", "runtime", 1, MeasurementCoverage.State.BLOCKED_BY_ANTIBOT, "ANTIBOT", "UNKNOWN"),
            new MeasurementCoverage.Check("runtime.not_applicable", "performance", "runtime", 1, MeasurementCoverage.State.NOT_APPLICABLE, null, "UNKNOWN"),
            new MeasurementCoverage.Check("runtime.missing", "performance", "runtime", 1, MeasurementCoverage.State.MEASURED, null, "HIGH"));
        var aggregate = new MeasurementCoverage.Aggregate("global", 1, 5, .2, true, false);
        var coverage = new MeasurementCoverage("test", .8, aggregate, List.of(), expected, true);
        var score = new AuditScoreReport(1, "test", ScoreAggregate.of("global", 50, 100),
            List.of(), List.of(), List.of(), Map.of(), List.of(), coverage);
        var report = new AuditReportJson(4, "https://example.com/page", "https://example.com/page", Instant.now(), Map.of(),
            List.of(new AuditModuleResult("http", "HTTP", "ok", Map.of(), List.of(check("http.status_code", AuditStatus.PASS))),
                new AuditModuleResult("runtime", "Runtime", "failed", Map.of(), List.of(check("runtime.lcp", AuditStatus.FAIL))),
                new AuditModuleResult("lighthouse", "Lighthouse", "ok", Map.of(), List.of(
                    check("lighthouse.audit.font-display-insight", AuditStatus.WARN), check("lighthouse.audit.font-display-insight", AuditStatus.WARN)))), score);
        var dto = new PublicReportComposer().compose(report);
        assertEquals(List.of("lighthouse.audit.font-display-insight"), dto.issues().stream().map(ReportDto.Issue::id).toList());
        assertEquals(1, dto.summary().priorities().size());
        var inventory = dto.diagnostics();
        assertEquals(new ReportDiagnostics.Scope("page", 1, false), inventory.scope());
        assertEquals(6, inventory.checks().size());
        assertEquals(1, inventory.checks().stream().filter(c -> c.state() == ReportDiagnostics.State.PASSED).count());
        assertEquals(3, inventory.checks().stream().filter(c -> c.state() == ReportDiagnostics.State.UNAVAILABLE).count());
        assertEquals(1, inventory.checks().stream().filter(c -> c.state() == ReportDiagnostics.State.NOT_APPLICABLE).count());
        assertEquals(1, inventory.checks().stream().filter(c -> c.state() == ReportDiagnostics.State.FINDING).count());
        var mapper = new ObjectMapper();
        assertEquals(inventory, mapper.readValue(mapper.writeValueAsString(inventory), ReportDiagnostics.class));
        assertNull(dto.publicSummary().diagnostics());
    }

    @Test void anEmptyHistoricalRunIsNotACompletedSiteAudit() {
        var report = new AuditReportJson(1, "https://example.com", "https://example.com", Instant.now(), Map.of(), List.of(), null);
        assertTrue(ReportDiagnostics.from(report, List.of()).checks().isEmpty());
    }
}
