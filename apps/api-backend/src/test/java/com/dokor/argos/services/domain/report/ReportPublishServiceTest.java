package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.sql.Configuration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReportPublishServiceTest {
    private final DataSource dataSource = mock(DataSource.class);
    private final Connection connection = mock(Connection.class);
    private final AuditRunDao runs = mock(AuditRunDao.class);
    private final AuditReportDao reports = mock(AuditReportDao.class);
    private final PublicReportComposer composer = mock(PublicReportComposer.class);
    private final AiReportSummaryService summaries = mock(AiReportSummaryService.class);
    private final AuditReportJson internal = mock(AuditReportJson.class);
    private ReportPublishService service;
    private Audit audit;
    private AuditRun run;

    @BeforeEach
    void setUp() throws Exception {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getAutoCommit()).thenReturn(true);
        service = new ReportPublishService(
            new TransactionManagerQuerydsl(dataSource, mock(Configuration.class)),
            runs, reports, composer, summaries, new ObjectMapper());
        audit = new Audit();
        audit.setId(7L);
        audit.setNormalizedUrl("https://example.com/page");
        run = new AuditRun();
        run.setId(42L);
        run.setAuditId(7L);
        run.setClaimToken("worker-claim");
        run.setStatus("RUNNING");
        run.setReportTokenHash(new TokenService().sha256("pre-generated-token"));
        when(runs.lockForPublication(42L, connection)).thenReturn(Optional.of(run));
        when(reports.findByRunId(42L, connection)).thenReturn(Optional.empty());
        ReportDto dto = new ReportDto("now", "example.com", "https://example.com/page",
            new ReportDto.Site("Example", null), null, null, List.of(), null, null);
        when(composer.compose(internal)).thenReturn(dto);
        when(summaries.enrich(dto)).thenReturn(dto);
    }

    @Test
    void publishesUsingPreGeneratedHashAndCompletesOnSameConnection() throws Exception {
        when(reports.save(any(AuditReport.class), eq(connection))).thenAnswer(invocation -> {
            AuditReport report = invocation.getArgument(0);
            report.setId(88L);
            return report;
        });
        when(runs.markCompleted(eq(42L), eq("worker-claim"), any(), eq("result"), eq(connection)))
            .thenReturn(true);

        assertEquals(88L, service.completeAndPublish(42L, audit, internal, "result", "worker-claim"));
        var report = org.mockito.ArgumentCaptor.forClass(AuditReport.class);
        verify(reports).save(report.capture(), eq(connection));
        assertArrayEquals(run.getReportTokenHash(), report.getValue().getTokenHash());
        assertEquals(42L, report.getValue().getRunId());
        assertEquals(7L, report.getValue().getAuditId());
        assertTrue(report.getValue().getReportJson().contains("Example"));
        verify(connection).commit();
        verify(connection, never()).rollback();
    }

    @Test
    void completedRunReturnsExistingReportWithoutWritingAnother() throws Exception {
        run.setStatus("COMPLETED");
        AuditReport existing = new AuditReport();
        existing.setId(99L);
        when(reports.findByRunId(42L, connection)).thenReturn(Optional.of(existing));

        assertEquals(99L, service.completeAndPublish(42L, audit, internal, "result", "worker-claim"));
        verify(reports, never()).save(any(AuditReport.class), any(Connection.class));
        verify(runs, never()).markCompleted(anyLong(), anyString(), any(), anyString(), any());
        verify(connection).commit();
    }

    @Test
    void rejectedCompletionThrowsAndRollsBackReportInsert() throws Exception {
        when(reports.save(any(AuditReport.class), eq(connection))).thenAnswer(invocation -> {
            AuditReport report = invocation.getArgument(0);
            report.setId(88L);
            return report;
        });
        when(runs.markCompleted(eq(42L), eq("worker-claim"), any(), eq("result"), eq(connection)))
            .thenReturn(false);

        assertEquals("Run completion rejected", assertThrows(IllegalStateException.class,
            () -> service.completeAndPublish(42L, audit, internal, "result", "worker-claim")).getMessage());
        verify(connection).rollback();
        verify(connection, never()).commit();
    }

    @Test
    void missingCredentialHashFailsBeforeReportInsertOrCompletion() throws Exception {
        run.setReportTokenHash(null);

        assertEquals("Missing report credential hash", assertThrows(IllegalStateException.class,
            () -> service.completeAndPublish(42L, audit, internal, "result", "worker-claim")).getMessage());
        verify(reports, never()).save(any(AuditReport.class), any(Connection.class));
        verify(runs, never()).markCompleted(anyLong(), anyString(), any(), anyString(), any());
        verify(connection).rollback();
    }

    @Test
    void staleWorkerCannotPublish() throws Exception {
        assertEquals("Worker no longer owns this run", assertThrows(IllegalStateException.class,
            () -> service.completeAndPublish(42L, audit, internal, "result", "another-worker")).getMessage());
        verifyNoInteractions(reports);
        verify(connection).rollback();
    }
}
