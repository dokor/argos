package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.domain.audit.model.ModuleStatus;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires de {@link AuditRunService} : pré-génération du reportToken,
 * initialisation et mise à jour des statuts de modules, tolérance au JSON
 * corrompu.
 */
class AuditRunServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private AuditRunService newService(AuditRunDao dao, TokenService tokenService) {
        return new AuditRunService(dao, tokenService, objectMapper);
    }

    private List<ModuleStatus> parse(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<List<ModuleStatus>>() {});
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String serialize(List<ModuleStatus> statuses) {
        try {
            return objectMapper.writeValueAsString(statuses);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ─── createQueuedRun ──────────────────────────────────────────────────────

    @Test
    void createQueuedRun_preGeneratesTokenAndInitialisesModulesToPending() {
        AuditRunDao dao = mock(AuditRunDao.class);
        TokenService tokenService = mock(TokenService.class);
        when(tokenService.generateToken()).thenReturn("PREGEN_TOKEN_123456");
        when(dao.save(any(AuditRun.class))).thenAnswer(inv -> {
            AuditRun r = inv.getArgument(0);
            r.setId(42L);
            return r;
        });

        AuditRun saved = newService(dao, tokenService).createQueuedRun(7L, Instant.now());

        assertEquals("PREGEN_TOKEN_123456", saved.getReportToken());
        List<ModuleStatus> statuses = parse(saved.getModuleStatuses());
        assertEquals(AuditRunService.INITIAL_MODULE_STATUSES.size(), statuses.size());
        assertTrue(statuses.stream().allMatch(m -> ModuleStatus.PENDING.equals(m.status())));
        assertTrue(statuses.stream().anyMatch(m -> m.id().equals("http")));
    }

    // ─── updateModuleStatus ───────────────────────────────────────────────────

    @Test
    void updateModuleStatus_updatesOnlyTargetModule() {
        AuditRunDao dao = mock(AuditRunDao.class);
        newService(dao, mock(TokenService.class)).updateModuleStatus(1L, "http", ModuleStatus.RUNNING);
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(dao).updateModuleStatus(eq(1L), eq("http"), eq(ModuleStatus.RUNNING), json.capture(), eq(false));
        assertEquals(AuditRunService.INITIAL_MODULE_STATUSES, parse(json.getValue()));
        verify(dao, never()).findById(anyLong());
        verify(dao, never()).updateModuleStatuses(anyLong(), anyString());
    }

    @Test
    void updateModuleStatus_noopWhenRunMissing() {
        AuditRunDao dao = mock(AuditRunDao.class);
        newService(dao, mock(TokenService.class)).updateModuleStatus(99L, "http", ModuleStatus.RUNNING);
        verify(dao).updateModuleStatus(eq(99L), eq("http"), eq(ModuleStatus.RUNNING), anyString(), eq(false));
        verify(dao, never()).findById(anyLong());
        verify(dao, never()).updateModuleStatuses(anyLong(), anyString());
    }

    @Test
    void updateModuleStatus_rejectsUnknownModulesAndInvalidStatusesBeforeDbAccess() {
        AuditRunDao dao = mock(AuditRunDao.class);
        var service = newService(dao, mock(TokenService.class));
        assertThrows(IllegalArgumentException.class, () -> service.updateModuleStatus(1, "unknown", "RUNNING"));
        assertThrows(IllegalArgumentException.class, () -> service.updateModuleStatus(1, "ssl", "PENDING"));
        verifyNoInteractions(dao);
    }

    // ─── failRunningModules ───────────────────────────────────────────────────

    @Test
    void failRunningModules_marksOnlyRunningAsFailed() {
        AuditRunDao dao = mock(AuditRunDao.class);
        newService(dao, mock(TokenService.class)).failRunningModules(1L);
        for (ModuleStatus module : AuditRunService.INITIAL_MODULE_STATUSES)
            verify(dao).updateModuleStatus(eq(1L), eq(module.id()), eq(ModuleStatus.FAILED), anyString(), eq(true));
        verify(dao, never()).findById(anyLong());
        verify(dao, never()).updateModuleStatuses(anyLong(), anyString());
    }

    // ─── findByReportToken ────────────────────────────────────────────────────

    @Test
    void findByReportToken_delegatesToDao() {
        AuditRunDao dao = mock(AuditRunDao.class);
        AuditRun run = new AuditRun();
        run.setId(5L);
        when(dao.findByReportToken("tok")).thenReturn(Optional.of(run));

        Optional<AuditRun> result = newService(dao, mock(TokenService.class)).findByReportToken("tok");

        assertTrue(result.isPresent());
        assertEquals(5L, result.get().getId());
    }

    private static ModuleStatus find(List<ModuleStatus> list, String id) {
        return list.stream().filter(m -> m.id().equals(id)).findFirst().orElseThrow();
    }
}
