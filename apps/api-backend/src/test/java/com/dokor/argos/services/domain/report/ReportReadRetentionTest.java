package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class ReportReadRetentionTest {
    @Test void historicalExpiryRevokesTokenRunAndPolling() {
        var dao=mock(AuditReportDao.class);var tokens=new TokenService();var entity=new AuditReport();
        entity.setCreatedAt(Instant.now().minus(1461,ChronoUnit.DAYS));entity.setTokenHash(tokens.sha256("synthetic-link"));entity.setReportJson("{\"domain\":\"fixture.invalid\"}");
        when(dao.findByTokenHash(any())).thenReturn(Optional.of(entity));when(dao.findByRunId(1)).thenReturn(Optional.of(entity));
        var reader=new ReportReadService(dao,tokens,new ObjectMapper().findAndRegisterModules());
        assertTrue(reader.getByToken("synthetic-link").isEmpty());assertTrue(reader.getByRunId(1).isEmpty());assertTrue(reader.isExpired(1));
    }
    @Test void currentReportsAndPendingRunsRemainReadable() {
        var dao=mock(AuditReportDao.class);var tokens=new TokenService();var entity=new AuditReport();
        entity.setCreatedAt(Instant.now());entity.setTokenHash(tokens.sha256("synthetic-link"));entity.setReportJson("{\"domain\":\"fixture.invalid\"}");
        when(dao.findByTokenHash(any())).thenReturn(Optional.of(entity));when(dao.findByRunId(1)).thenReturn(Optional.of(entity));when(dao.findByRunId(2)).thenReturn(Optional.empty());
        var reader=new ReportReadService(dao,tokens,new ObjectMapper().findAndRegisterModules());
        assertTrue(reader.getByToken("synthetic-link").isPresent());assertTrue(reader.getByRunId(1).isPresent());assertFalse(reader.isExpired(1));assertFalse(reader.isExpired(2));
    }
}
