package com.dokor.argos.services.scheduler;

import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.analysis.AuditProcessorService;
import com.dokor.argos.services.domain.audit.AuditRunService;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditQueueServiceTest {
    @Test void onlyClaimedRunsAreProcessed() {
        AuditRunService runs = mock(AuditRunService.class);
        AuditProcessorService processor = mock(AuditProcessorService.class);
        AuditRun claimed = new AuditRun();
        claimed.setId(42L);
        when(runs.claimNextQueuedRun()).thenReturn(Optional.empty(), Optional.of(claimed));
        AuditQueueService queue = new AuditQueueService(runs, processor);

        assertFalse(queue.processNextQueuedRun());
        verifyNoInteractions(processor);
        assertTrue(queue.processNextQueuedRun());
        verify(processor).process(42L);
    }
}
