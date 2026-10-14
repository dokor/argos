package com.dokor.argos.services.domain.audit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.configuration.ConfigurationService;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.*;
import java.util.*;

class StuckAuditRunReaperTest {
    AuditRunDao dao;
    AuditRunService service;
    StuckAuditRunReaper reaper;

    @BeforeEach
    void setup() {
        dao = mock(AuditRunDao.class);
        service = mock(AuditRunService.class);
        var config = mock(ConfigurationService.class);
        when(config.auditStuckRunTimeout()).thenReturn(Duration.ofMinutes(20));
        when(config.auditMaxAttempts()).thenReturn(3);
        when(service.initialModuleStatusesJson()).thenReturn("initial");
        reaper = new StuckAuditRunReaper(dao, service, config);
    }

    @Test
    void noStuckRun() {
        when(dao.findStuckRunningRuns(any())).thenReturn(List.of());
        var before = Instant.now().minusSeconds(1200);
        assertEquals(0, reaper.reapStuckRuns());
        var threshold = org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(dao).findStuckRunningRuns(threshold.capture());
        assertFalse(threshold.getValue().isBefore(before));
        assertFalse(threshold.getValue().isAfter(Instant.now().minusSeconds(1200)));
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @EnumSource(AuditRunDao.Recovery.class)
    void delegatesObservedClaimToAtomicRecovery(AuditRunDao.Recovery result) {
        var run = new AuditRun();
        run.setId(42L);
        run.setClaimToken("observed-worker");
        run.setStartedAt(Instant.now().minusSeconds(1300));
        when(dao.findStuckRunningRuns(any())).thenReturn(List.of(run));
        when(dao.recoverStuck(same(run), eq(3), any(), eq("initial"))).thenReturn(result);
        assertEquals(result == AuditRunDao.Recovery.STALE ? 0 : 1, reaper.reapStuckRuns());
        verify(dao).recoverStuck(same(run), eq(3), any(), eq("initial"));
        verify(service, times(result == AuditRunDao.Recovery.FAILED ? 1 : 0))
                .failRunningModules(42L);
    }
}
