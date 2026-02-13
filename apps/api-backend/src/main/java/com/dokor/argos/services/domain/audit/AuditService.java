package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.analysis.AuditProcessorService;
import com.dokor.argos.services.domain.audit.errors.NotFoundException;
import com.dokor.argos.webservices.api.audits.data.AuditListItemResponse;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
import com.dokor.argos.webservices.api.audits.data.CreateAuditRequest;
import com.dokor.argos.webservices.api.audits.data.CreateAuditResponse;
import com.querydsl.core.Tuple;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.List;

@Singleton
public class AuditService {
    private static final Logger logger = LoggerFactory.getLogger(AuditService.class);

    private final AuditDao auditDao;
    private final AuditRunService auditRunService;
    private final AuditProcessorService auditProcessorService;
    private final UrlNormalizer urlNormalizer;

    @Inject
    public AuditService(
        AuditDao auditDao,
        AuditRunService auditRunService,
        AuditProcessorService auditProcessorService,
        UrlNormalizer urlNormalizer
    ) {
        this.auditDao = auditDao;
        this.auditRunService = auditRunService;
        this.auditProcessorService = auditProcessorService;
        this.urlNormalizer = urlNormalizer;
    }

    /**
     * Liste (MVP) des audits avec dernier run associé.
     * @param limit nb max d'items (ex: 50)
     */
    public List<AuditListItemResponse> listAudits(int limit) {
        logger.info("Listing audits limit={}", limit);

        List<Tuple> rows = auditDao.listAuditsWithLatestRun(limit);

        return rows.stream().map(row -> {
            Audit audit = row.get(0, Audit.class);
            AuditRun run = row.get(1, AuditRun.class);
            AuditReport report = row.get(2, AuditReport.class);

            if (run == null || report == null) {
                // Cas rare : audit créé sans run
                return new AuditListItemResponse(
                    audit.getId(),
                    audit.getInputUrl(),
                    audit.getNormalizedUrl(),
                    0L,
                    "NO_RUN",
                    audit.getCreatedAt(),
                    null,
                    null,
                    null,
                    null
                );
            }

            return new AuditListItemResponse(
                audit.getId(),
                audit.getInputUrl(),
                audit.getNormalizedUrl(),
                run.getId(),
                run.getStatus(),
                run.getCreatedAt(),
                run.getFinishedAt(),
                report.getPublicToken(),
                report.getPublicToken(),
                run.getResultJson()
            );
        }).toList();
    }

    /**
     * Méthode appelée par le scheduler.
     * Elle :
     * - tente de récupérer un run QUEUED
     * - le claim
     * - lance le traitement
     */
    public boolean processNextQueuedRun() {
        logger.debug("Scheduler tick: looking for queued audit run");

        return auditRunService.claimNextQueuedRun()
            .map(run -> {
                logger.info("Processing queued runId={}", run.getId());
                auditProcessorService.process(run.getId());
                return true;
            })
            .orElse(false);
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
            run.getResultJson(),
            null
        );
    }
}
