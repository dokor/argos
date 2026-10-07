package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.scoring.AuditScoreReport;
import com.dokor.argos.services.analysis.scoring.ScoreAggregate;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReportPublishScoreTest {
    private static AuditReportJson internal() {
        var score = new AuditScoreReport(11, "frozen-method", ScoreAggregate.of("global", 68, 100),
            List.of(), List.of(), List.of(), Map.of(), List.of());
        return new AuditReportJson(2, "https://example.com", "https://example.com", null,
            Map.of(), List.of(), score);
    }

    private static ReportDto report(int score, boolean available, int version, String fingerprint) {
        return new ReportDto(null, null, null, null,
            new ReportDto.Scores(score, null, List.of(), available,
                new ReportDto.ScoreCalculation(version, fingerprint, List.of())),
            null, List.of(), null, null);
    }

    @Test void publishedScoreMatchesFrozenMethod() {
        assertEquals(68, ReportPublishService.publishedGlobalScore(internal(), report(68, true, 11, "frozen-method")));
        assertNull(ReportPublishService.publishedGlobalScore(internal(), report(0, false, 11, "frozen-method")));
        assertThrows(IllegalStateException.class, () -> ReportPublishService.publishedGlobalScore(
            internal(), report(68, true, 12, "frozen-method")));
        assertThrows(IllegalStateException.class, () -> ReportPublishService.publishedGlobalScore(
            internal(), report(68, true, 11, "different")));
        assertThrows(IllegalStateException.class, () -> ReportPublishService.publishedGlobalScore(
            internal(), report(67, true, 11, "frozen-method")));
    }
}
