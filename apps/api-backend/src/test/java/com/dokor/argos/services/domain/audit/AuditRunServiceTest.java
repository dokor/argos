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
        AuditRun run = new AuditRun();
        run.setId(1L);
        run.setModuleStatuses(serialize(AuditRunService.INITIAL_MODULE_STATUSES));
        when(dao.findById(1L)).thenReturn(run);

        newService(dao, mock(TokenService.class)).updateModuleStatus(1L, "http", ModuleStatus.RUNNING);

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(dao).updateModuleStatuses(eq(1L), json.capture());
        List<ModuleStatus> result = parse(json.getValue());
        assertEquals(ModuleStatus.RUNNING, find(result, "http").status());
        assertEquals(ModuleStatus.PENDING, find(result, "html").status());
    }

    @Test
    void updateModuleStatus_noopWhenRunMissing() {
        AuditRunDao dao = mock(AuditRunDao.class);
        when(dao.findById(99L)).thenReturn(null);

        newService(dao, mock(TokenService.class)).updateModuleStatus(99L, "http", ModuleStatus.RUNNING);

        verify(dao, never()).updateModuleStatuses(anyLong(), anyString());
    }

    @Test
    void updateModuleStatus_fallsBackOnCorruptJson() {
        AuditRunDao dao = mock(AuditRunDao.class);
        AuditRun run = new AuditRun();
        run.setId(1L);
        run.setModuleStatuses("{ not valid json");
        when(dao.findById(1L)).thenReturn(run);

        // Ne doit pas lever : on repart des statuts initiaux puis on applique la MAJ.
        newService(dao, mock(TokenService.class)).updateModuleStatus(1L, "ssl", ModuleStatus.COMPLETED);

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(dao).updateModuleStatuses(eq(1L), json.capture());
        List<ModuleStatus> result = parse(json.getValue());
        assertEquals(ModuleStatus.COMPLETED, find(result, "ssl").status());
    }

    // ─── failRunningModules ───────────────────────────────────────────────────

    @Test
    void failRunningModules_marksOnlyRunningAsFailed() {
        AuditRunDao dao = mock(AuditRunDao.class);
        List<ModuleStatus> statuses = List.of(
            new ModuleStatus("http", "HTTP", ModuleStatus.COMPLETED),
            new ModuleStatus("html", "HTML", ModuleStatus.RUNNING),
            new ModuleStatus("ssl", "SSL", ModuleStatus.PENDING)
        );
        AuditRun run = new AuditRun();
        run.setId(1L);
        run.setModuleStatuses(serialize(statuses));
        when(dao.findById(1L)).thenReturn(run);

        newService(dao, mock(TokenService.class)).failRunningModules(1L);

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(dao).updateModuleStatuses(eq(1L), json.capture());
        List<ModuleStatus> result = parse(json.getValue());
        assertEquals(ModuleStatus.COMPLETED, find(result, "http").status());
        assertEquals(ModuleStatus.FAILED, find(result, "html").status());
        assertEquals(ModuleStatus.PENDING, find(result, "ssl").status());
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
