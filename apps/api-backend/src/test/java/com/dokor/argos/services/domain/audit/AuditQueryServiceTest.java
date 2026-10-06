package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.AuditRun;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.core.Tuple;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditQueryServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void scoreRespectsUnavailableAndMissingValues() throws Exception {
        assertEquals(68, AuditQueryService.globalScore(mapper.readTree("{\"scores\":{\"global\":68}}")));
        assertNull(AuditQueryService.globalScore(mapper.readTree(
            "{\"scores\":{\"global\":0,\"globalAvailable\":false}}")));
        assertNull(AuditQueryService.globalScore(mapper.readTree("{\"scores\":{}}")));
        assertNull(AuditQueryService.globalScore(null));
    }

    @Test void historyParsesPublishedReportOnceForScoreAndComparison() throws Exception {
        AuditDao audits = mock(AuditDao.class);
        AuditRunService runs = mock(AuditRunService.class);
        ObjectMapper countingMapper = spy(new ObjectMapper());
        String reportJson = "{\"scores\":{\"global\":68,\"globalAvailable\":true}}";
        AuditRun run = new AuditRun();
        run.setId(42L);
        AuditReport report = new AuditReport();
        report.setReportJson(reportJson);
        Tuple tuple = mock(Tuple.class);
        when(tuple.get(0, AuditRun.class)).thenReturn(run);
        when(tuple.get(1, AuditReport.class)).thenReturn(report);
        when(audits.listRunsWithReportByAuditId(1, 20)).thenReturn(List.of(tuple));

        var history = new AuditQueryService(audits, runs, countingMapper).getAuditHistory(1, 20);
        assertEquals(68, history.getFirst().globalScore());
        assertTrue(history.getFirst().hasReport());
        verify(countingMapper, times(1)).readTree(reportJson);
    }
}
