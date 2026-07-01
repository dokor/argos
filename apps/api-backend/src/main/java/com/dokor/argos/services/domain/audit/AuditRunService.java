package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.domain.audit.enums.AuditRunStatus;
import com.dokor.argos.services.domain.audit.model.ModuleStatus;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Singleton
public class AuditRunService {
    private static final Logger logger = LoggerFactory.getLogger(AuditRunService.class);

    /**
     * Liste ordonnée des modules dans l'ordre d'exécution.
     * Utilisée pour initialiser les statuts à PENDING à la création du run.
     */
    static final List<ModuleStatus> INITIAL_MODULE_STATUSES = List.of(
        new ModuleStatus("http",        "HTTP & Sécurité", ModuleStatus.PENDING),
        new ModuleStatus("html",        "HTML & SEO",      ModuleStatus.PENDING),
        new ModuleStatus("runtime",     "Runtime",         ModuleStatus.PENDING),
        new ModuleStatus("lighthouse",  "Lighthouse",      ModuleStatus.PENDING),
        new ModuleStatus("observatory", "Observatory",     ModuleStatus.PENDING),
        new ModuleStatus("ssl",         "SSL Labs",        ModuleStatus.PENDING),
        new ModuleStatus("zap",         "ZAP",             ModuleStatus.PENDING),
        new ModuleStatus("tech",        "Stack",           ModuleStatus.PENDING)
    );

    private final AuditRunDao auditRunDao;
    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

    @Inject
    public AuditRunService(AuditRunDao auditRunDao, TokenService tokenService, ObjectMapper objectMapper) {
        this.auditRunDao = auditRunDao;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    /**
     * Récupère le prochain run en QUEUED et le claim de façon atomique.
     */
    public Optional<AuditRun> claimNextQueuedRun() {
        return auditRunDao.findNextQueuedRun()
            .flatMap(run -> {
                String token = UUID.randomUUID().toString().replace("-", "");
                boolean claimed = auditRunDao.claimRun(run.getId(), token, Instant.now());

                if (!claimed) {
                    logger.debug("Run already claimed by another worker runId={}", run.getId());
                    return Optional.empty();
                }

                logger.info("Run claimed runId={}", run.getId());
                return Optional.of(run);
            });
    }

    /**
     * Crée un AuditRun en statut QUEUED avec un reportToken pré-généré
     * et les statuts de modules initialisés à PENDING.
     */
    public AuditRun createQueuedRun(long auditId, Instant now) {
        logger.info("Creating QUEUED run for auditId={}", auditId);

        String reportToken = tokenService.generateToken();
        String moduleStatusesJson = serializeModuleStatuses(INITIAL_MODULE_STATUSES);

        AuditRun run = new AuditRun();
        run.setAuditId(auditId);
        run.setStatus(AuditRunStatus.QUEUED.name());
        run.setCreatedAt(now);
        run.setReportToken(reportToken);
        run.setModuleStatuses(moduleStatusesJson);

        AuditRun saved = auditRunDao.save(run);
        logger.debug("Run persisted: runId={} reportToken={}", saved.getId(), safeToken(reportToken));
        return saved;
    }

    public Optional<AuditRun> getRun(long runId) {
        return Optional.ofNullable(auditRunDao.findById(runId));
    }

    public Optional<AuditRun> findByReportToken(String reportToken) {
        return auditRunDao.findByReportToken(reportToken);
    }

    /**
     * Met à jour le statut d'un module spécifique dans le JSON stocké en base.
     *
     * @param runId    identifiant du run
     * @param moduleId id technique du module (ex : {@code "http"})
     * @param status   nouveau statut ({@code RUNNING | COMPLETED | FAILED | SKIPPED})
     */
    public void updateModuleStatus(long runId, String moduleId, String status) {
        AuditRun run = auditRunDao.findById(runId);
        if (run == null) {
            logger.warn("Cannot update module status: run not found runId={}", runId);
            return;
        }

        List<ModuleStatus> statuses = deserializeModuleStatuses(run.getModuleStatuses());
        List<ModuleStatus> updated = statuses.stream()
            .map(m -> m.id().equals(moduleId) ? m.withStatus(status) : m)
            .toList();

        auditRunDao.updateModuleStatuses(runId, serializeModuleStatuses(updated));
        logger.debug("Module status updated runId={} module={} status={}", runId, moduleId, status);
    }

    /**
     * Tente de claim un run pour traitement.
     */
    public Optional<String> claim(long runId) {
        String token = UUID.randomUUID().toString().replace("-", "");
        boolean claimed = auditRunDao.claimRun(runId, token, Instant.now());

        if (claimed) {
            logger.info("Run successfully claimed: runId={}", runId);
            return Optional.of(token);
        }

        logger.debug("Run already claimed or not in QUEUED state: runId={}", runId);
        return Optional.empty();
    }

    public void complete(long runId, String resultJson) {
        logger.info("Marking run as COMPLETED: runId={}", runId);
        auditRunDao.markCompleted(runId, Instant.now(), resultJson);
    }

    public void fail(long runId, String errorMessage) {
        logger.warn("Marking run as FAILED: runId={}, error={}", runId, errorMessage);
        auditRunDao.markFailed(runId, Instant.now(), errorMessage);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private String serializeModuleStatuses(List<ModuleStatus> statuses) {
        try {
            return objectMapper.writeValueAsString(statuses);
        } catch (Exception e) {
            logger.warn("Cannot serialize module statuses", e);
            return "[]";
        }
    }

    private List<ModuleStatus> deserializeModuleStatuses(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>(INITIAL_MODULE_STATUSES);
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<ModuleStatus>>() {});
        } catch (Exception e) {
            logger.warn("Cannot deserialize module statuses: {}", e.getMessage());
            return new ArrayList<>(INITIAL_MODULE_STATUSES);
        }
    }

    private static String safeToken(String token) {
        if (token == null) return "null";
        return token.length() <= 8 ? "****" : token.substring(0, 4) + "…";
    }
}
