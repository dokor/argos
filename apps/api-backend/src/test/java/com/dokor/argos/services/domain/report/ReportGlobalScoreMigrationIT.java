package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.scoring.AuditScoreReport;
import com.dokor.argos.services.analysis.scoring.ScoreAggregate;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Real MariaDB fixture is enabled only with isolated ARGOS_TEST_CREDENTIALS_* settings. */
class ReportGlobalScoreMigrationIT extends MariaDbReportFixture {
    @Test void legacyScoresStayUnknownAndNewPublicationStoresValidatedScore() throws Exception {
        assertNull(reports.findByRunId(1).orElseThrow().getGlobalScore());

        sql("UPDATE ARG_AUDIT_RUN SET status='RUNNING', claim_token='worker', "
            + "report_token_hash=UNHEX(SHA2('synthetic-score-token',256)) WHERE id=5");
        var transactions = new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT));
        var composer = mock(PublicReportComposer.class);
        var summaries = mock(AiReportSummaryService.class);
        var score = new AuditScoreReport(11, "frozen-method", ScoreAggregate.of("global", 68, 100),
            List.of(), List.of(), List.of(), Map.of(), List.of());
        var internal = new AuditReportJson(2, "https://example.com", "https://example.com",
            null, Map.of(), List.of(), score);
        var dto = new ReportDto(null, "example.com", "https://example.com", null,
            new ReportDto.Scores(68, null, List.of(), true,
                new ReportDto.ScoreCalculation(11, "frozen-method", List.of())),
            null, List.of(), null, null);
        when(composer.compose(any())).thenReturn(dto);
        when(summaries.enrich(any())).thenAnswer(call -> call.getArgument(0));
        var publisher = new ReportPublishService(transactions, new AuditRunDao(transactions),
            new AuditReportDao(transactions), composer, summaries, mapper);
        Audit audit = new Audit();
        audit.setId(1L);
        audit.setNormalizedUrl("https://example.com");
        publisher.completeAndPublish(5, audit, internal, "{}", "worker");

        var published = reports.findByRunId(5).orElseThrow();
        assertEquals(68, published.getGlobalScore());
        assertEquals(11, published.getScoringVersion());
    }
}
