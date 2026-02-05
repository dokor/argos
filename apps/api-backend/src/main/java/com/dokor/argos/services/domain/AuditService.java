package com.dokor.argos.services.domain;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.domain.errors.NotFoundException;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
import com.dokor.argos.webservices.api.audits.data.CreateAuditRequest;
import com.dokor.argos.webservices.api.audits.data.CreateAuditResponse;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

@Singleton
public class AuditService {
    private static final Logger logger = LoggerFactory.getLogger(AuditService.class);

    private final AuditDao auditDao;
    private final AuditRunService auditRunService;
    private final UrlNormalizer urlNormalizer;

    @Inject
    public AuditService(AuditDao auditDao, AuditRunService auditRunService, UrlNormalizer urlNormalizer) {
        this.auditDao = auditDao;
        this.auditRunService = auditRunService;
        this.urlNormalizer = urlNormalizer;
    }

    /**
     * Point d’entrée métier typique quand un utilisateur soumet une URL :
     * - normalise l’URL
     * - récupère ou crée l’Audit (idempotent)
     * - crée un AuditRun en QUEUED
     */
    public CreateAuditResponse createAudit(CreateAuditRequest request) {
        String inputUrl = request.url();
        logger.info("AuditService.createAudit inputUrl={}", inputUrl);

        String normalizedUrl = urlNormalizer.normalize(inputUrl);
        String hostname = urlNormalizer.extractHostname(normalizedUrl);
        Instant now = Instant.now();

        Audit audit = auditDao.findByNormalizedUrl(normalizedUrl)
            .orElseGet(() -> {
                logger.info("Creating new Audit for normalizedUrl={}", normalizedUrl);
                Audit a = new Audit();
                a.setInputUrl(inputUrl);
                a.setNormalizedUrl(normalizedUrl);
                a.setHostname(hostname);
                a.setCreatedAt(now);
                return auditDao.save(a);
            });

        AuditRun run = auditRunService.createQueuedRun(audit.getId(), now);

        logger.info("Run created: auditId={}, runId={}, status={}", audit.getId(), run.getId(), run.getStatus());

        return new CreateAuditResponse(
            run.getId(),
            run.getAuditId(),
            run.getStatus(),
            run.getCreatedAt()
        );
    }

    public AuditRunStatusResponse getRunStatus(long runId) {
        logger.debug("AuditService.getRunStatus runId={}", runId);

        AuditRun run = auditRunService.getRun(runId)
            .orElseThrow(() -> new NotFoundException("AuditRun not found: " + runId));

        return new AuditRunStatusResponse(
            run.getId(),
            run.getAuditId(),
            run.getStatus(),
            run.getCreatedAt(),
            run.getStartedAt(),
            run.getFinishedAt(),
            run.getLastError(),
            run.getResultJson()
        );
    }
}
