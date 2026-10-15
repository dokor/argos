package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HistoricalMeasurementsTest {
    final AuditReportDao dao = mock(AuditReportDao.class);
    final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    final ReportReadService reader = new ReportReadService(dao, new TokenService(), mapper);
    AuditReport stored(String json) {
        var entity = new AuditReport(); entity.setRunId(42L); entity.setId(1L);
        entity.setCreatedAt(Instant.now()); entity.setExpiresAt(Instant.now().plusSeconds(3600)); entity.setReportJson(json);
        when(dao.findByRunId(42)).thenReturn(Optional.of(entity)); return entity;
    }
    @Test void recoversOnlyRetainedNumbersWithoutRecomposingScoresOrEvidence() throws Exception {
        stored("{\"domain\":\"example.com\",\"scores\":{\"global\":64}}");
        when(dao.retainedResult(42)).thenReturn(Optional.of("""
            {"schemaVersion":1,"modules":[{"id":"runtime","data":{"network":{"requests":62,"status5xx":0},"timings":{"loadMs":5200},"private":"SECRET"},"checks":[]},
              {"id":"http","data":{"responseSnapshotAvailable":true,"durationMs":320},"checks":[]}]}
            """));
        var dto=reader.getByRunId(42).orElseThrow();
        assertEquals(64,dto.scores().global()); assertEquals(62,dto.measurements().requests());
        assertEquals(0,dto.measurements().http5xx()); assertEquals(320,dto.measurements().responseMs());
        assertNull(dto.measurements().lcpMs()); assertFalse(mapper.writeValueAsString(dto.publicSummary()).contains("SECRET"));
        verify(dao,never()).save(any(AuditReport.class));
    }
    @Test void missingOrMalformedRetainedResultsDoNotHideTheReportOrInventZero() {
        stored("{\"domain\":\"example.com\"}");
        when(dao.retainedResult(42)).thenReturn(Optional.empty());
        assertNull(reader.getByRunId(42).orElseThrow().measurements());
        when(dao.retainedResult(42)).thenReturn(Optional.of("broken"));
        assertNull(reader.getByRunId(42).orElseThrow().measurements());
    }
    @Test void currentSnapshotsAndExpiredReportsNeverReadRetainedResults() {
        var entity=stored("{\"measurements\":{\"requests\":0}}");
        assertEquals(0,reader.getByRunId(42).orElseThrow().measurements().requests());
        entity.setExpiresAt(Instant.EPOCH);
        assertTrue(reader.getByRunId(42).isEmpty()); verify(dao,never()).retainedResult(anyLong());
    }
}
