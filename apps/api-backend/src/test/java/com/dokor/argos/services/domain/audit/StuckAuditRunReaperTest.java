package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.configuration.ConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires de {@link StuckAuditRunReaper} : détection des runs bloqués,
 * relance des runs récupérables (requeue), abandon des non-récupérables (FAILED),
 * et prévention des doubles reprises (update atomique gardé).
 */
class StuckAuditRunReaperTest {

    private static final Duration TIMEOUT = Duration.ofMinutes(20);
    private static final int MAX_ATTEMPTS = 3;

    private AuditRunDao dao;
    private AuditRunService auditRunService;
    private ConfigurationService config;
    private StuckAuditRunReaper reaper;

    @BeforeEach
    void setUp() {
        dao = mock(AuditRunDao.class);
        auditRunService = mock(AuditRunService.class);
        config = mock(ConfigurationService.class);
        when(config.auditStuckRunTimeout()).thenReturn(TIMEOUT);
        when(config.auditMaxAttempts()).thenReturn(MAX_ATTEMPTS);
        reaper = new StuckAuditRunReaper(dao, auditRunService, config);
    }

    private AuditRun run(long id, int attemptCount) {
        AuditRun run = new AuditRun();
        run.setId(id);
        run.setAttemptCount(attemptCount);
        return run;
    }

    // ─── Détection ────────────────────────────────────────────────────────────

    @Test
    void reapStuckRuns_returnsZeroAndTouchesNothingWhenNoStuckRun() {
        when(dao.findStuckRunningRuns(any(Instant.class))).thenReturn(List.of());

        int handled = reaper.reapStuckRuns();

        assertEquals(0, handled);
        verify(dao, never()).requeueStuckRun(anyLong());
        verify(dao, never()).markStuckFailed(anyLong(), any(), anyString());
    }

    @Test
    void reapStuckRuns_queriesWithThresholdInThePast() {
        when(dao.findStuckRunningRuns(any(Instant.class))).thenReturn(List.of());
        Instant before = Instant.now().minus(TIMEOUT);

        reaper.reapStuckRuns();

        var captor = org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(dao).findStuckRunningRuns(captor.capture());
        // Le seuil doit être ~maintenant - timeout (dans le passé, cohérent au timeout près).
        Instant after = Instant.now().minus(TIMEOUT);
        assertFalse(captor.getValue().isBefore(before.minusSeconds(5)));
        assertFalse(captor.getValue().isAfter(after.plusSeconds(5)));
    }

    // ─── Relance (requeue) ──────────────────────────────────────────────────────

    @Test
    void reapStuckRuns_requeuesRecoverableRun() {
        when(dao.findStuckRunningRuns(any(Instant.class))).thenReturn(List.of(run(1L, 1)));
        when(dao.requeueStuckRun(1L)).thenReturn(true);

        int handled = reaper.reapStuckRuns();

        assertEquals(1, handled);
        verify(dao).requeueStuckRun(1L);
        verify(auditRunService).resetModuleStatuses(1L);
        verify(dao, never()).markStuckFailed(anyLong(), any(), anyString());
    }

    @Test
    void reapStuckRuns_treatsNullAttemptCountAsRecoverable() {
        AuditRun run = new AuditRun();
        run.setId(2L);
        run.setAttemptCount(null);
        when(dao.findStuckRunningRuns(any(Instant.class))).thenReturn(List.of(run));
        when(dao.requeueStuckRun(2L)).thenReturn(true);

        int handled = reaper.reapStuckRuns();

        assertEquals(1, handled);
        verify(dao).requeueStuckRun(2L);
        verify(dao, never()).markStuckFailed(anyLong(), any(), anyString());
    }

    // ─── Abandon (FAILED) ─────────────────────────────────────────────────────

    @Test
    void reapStuckRuns_abandonsRunWhenAttemptsExhausted() {
        when(dao.findStuckRunningRuns(any(Instant.class))).thenReturn(List.of(run(3L, MAX_ATTEMPTS)));
        when(dao.markStuckFailed(eq(3L), any(Instant.class), anyString())).thenReturn(true);

        int handled = reaper.reapStuckRuns();

        assertEquals(1, handled);
        verify(dao).markStuckFailed(eq(3L), any(Instant.class), anyString());
        verify(auditRunService).failRunningModules(3L);
        verify(dao, never()).requeueStuckRun(anyLong());
    }

    // ─── Prévention des doubles reprises ────────────────────────────────────────

    @Test
    void reapStuckRuns_doesNotResetModulesWhenRequeueLostRace() {
        // Le run a été terminé/re-claimé entre la détection et l'update : requeue échoue.
        when(dao.findStuckRunningRuns(any(Instant.class))).thenReturn(List.of(run(4L, 0)));
        when(dao.requeueStuckRun(4L)).thenReturn(false);

        int handled = reaper.reapStuckRuns();

        assertEquals(0, handled);
        verify(dao).requeueStuckRun(4L);
        verify(auditRunService, never()).resetModuleStatuses(anyLong());
    }

    @Test
    void reapStuckRuns_doesNotFailModulesWhenAbandonLostRace() {
        when(dao.findStuckRunningRuns(any(Instant.class))).thenReturn(List.of(run(5L, MAX_ATTEMPTS)));
        when(dao.markStuckFailed(eq(5L), any(Instant.class), anyString())).thenReturn(false);

        int handled = reaper.reapStuckRuns();

        assertEquals(0, handled);
        verify(auditRunService, never()).failRunningModules(anyLong());
    }

    // ─── Lot mixte ──────────────────────────────────────────────────────────────

    @Test
    void reapStuckRuns_handlesMixedBatch() {
        when(dao.findStuckRunningRuns(any(Instant.class)))
            .thenReturn(List.of(run(10L, 1), run(11L, MAX_ATTEMPTS), run(12L, 2)));
        when(dao.requeueStuckRun(10L)).thenReturn(true);
        when(dao.markStuckFailed(eq(11L), any(Instant.class), anyString())).thenReturn(true);
        when(dao.requeueStuckRun(12L)).thenReturn(true);

        int handled = reaper.reapStuckRuns();

        assertEquals(3, handled);
        verify(dao).requeueStuckRun(10L);
        verify(dao).markStuckFailed(eq(11L), any(Instant.class), anyString());
        verify(dao).requeueStuckRun(12L);
    }
}
