package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.domain.report.AuditComparisonService;
import com.dokor.argos.services.domain.report.ReportDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditQueryServiceTest {
    @Test void historyUsesDenormalizedScoreWithoutParsingReports() {
        AuditDao audits = mock(AuditDao.class);
        ObjectMapper mapper = spy(new ObjectMapper());
        when(audits.listRunsWithReportByAuditId(1, 20)).thenReturn(List.of(
            new AuditDao.HistoryRow(42, "COMPLETED", Instant.EPOCH, Instant.EPOCH, true, 68),
            new AuditDao.HistoryRow(41, "COMPLETED", Instant.EPOCH, Instant.EPOCH, true, null)));

        var history = new AuditQueryService(audits, mock(AuditRunService.class), mapper)
            .getAuditHistory(1, 20);
        assertEquals(68, history.getFirst().row().globalScore());
        assertNull(history.get(1).row().globalScore());
        verifyNoInteractions(mapper);
    }

    @Test void comparisonLoadsOnlyTheRequestedAndPreviousReports() throws Exception {
        AuditDao audits = mock(AuditDao.class);
        ObjectMapper mapper = spy(new ObjectMapper());
        AuditReport current = new AuditReport();
        current.setRunId(42L);
        current.setReportJson("{\"url\":\"https://example.com\",\"scores\":{\"global\":68,\"globalAvailable\":true}}");
        when(audits.comparisonReports(1, 42)).thenReturn(List.of(current));

        var detail = new AuditQueryService(audits, mock(AuditRunService.class), mapper)
            .getComparisonDetail(1, 42);
        assertEquals(AuditComparisonService.Reason.NO_PREVIOUS_REPORT, detail.comparison().reason());
        verify(mapper, times(1)).readValue(current.getReportJson(), ReportDto.class);
    }
}
