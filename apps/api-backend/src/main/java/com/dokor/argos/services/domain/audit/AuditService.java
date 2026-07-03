package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.Domain;
import com.dokor.argos.services.analysis.AuditProcessorService;
import com.dokor.argos.services.domain.audit.errors.NotFoundException;
import com.dokor.argos.services.domain.domain.DomainService;
import com.dokor.argos.webservices.api.audits.data.AuditHistoryItemResponse;
import com.dokor.argos.webservices.api.audits.data.AuditListItemResponse;
import com.dokor.argos.webservices.api.audits.data.AuditRunStatusResponse;
import com.dokor.argos.webservices.api.audits.data.CreateAuditRequest;
import com.dokor.argos.webservices.api.audits.data.CreateAuditResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private static final String REPORTS_BASE_PATH = "/reports/";

    private final AuditDao auditDao;
    private final AuditRunService auditRunService;
    private final AuditProcessorService auditProcessorService;
    private final UrlNormalizer urlNormalizer;
    private final DomainService domainService;
    private final ObjectMapper objectMapper;

    @Inject
    public AuditService(
        AuditDao auditDao,
        AuditRunService auditRunService,
        AuditProcessorService auditProcessorService,
        UrlNormalizer urlNormalizer,
        DomainService domainService,
        ObjectMapper objectMapper
    ) {
        this.auditDao = auditDao;
        this.auditRunService = auditRunService;
        this.auditProcessorService = auditProcessorService;
        this.urlNormalizer = urlNormalizer;
        this.domainService = domainService;
        this.objectMapper = objectMapper;
    }

    /**
     * Liste (MVP) des audits avec dernier run associé.
     * @param limit nb max d'items (ex: 50)
     */
    public List<AuditListItemResponse> listAudits(int limit) {
        logger.info("Listing audits limit={}", limit);

        List<Tuple> rows = auditDao.listAuditsWithLatestRun(limit);

        return rows.stream().map(row -> {
            Audit audit    = row.get(0, Audit.class);
            Domain domain  = row.get(1, Domain.class);
            AuditRun run   = row.get(2, AuditRun.class);
            AuditReport report = row.get(3, AuditReport.class);

            String hostname = domain != null ? domain.getHostname() : null;

            if (run == null) {
                // Cas rare : audit créé sans run
                return new AuditListItemResponse(
                    audit.getId(),
                    hostname,
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

            String token = report != null ? report.getPublicToken() : null;
            String reportUrl = token != null ? REPORTS_BASE_PATH + token : null;

            return new AuditListItemResponse(
                audit.getId(),
                hostname,
                audit.getInputUrl(),
                audit.getNormalizedUrl(),
                run.getId(),
                run.getStatus(),
                run.getCreatedAt(),
                run.getFinishedAt(),
                token,
                reportUrl,
                run.getResultJson()
            );
        }).toList();
    }

    /**
     * Historique des analyses d'un audit (une URL) : liste des runs passés,
     * du plus récent au plus ancien, avec lien de rapport et score global.
     *
     * @param auditId identifiant de l'audit
     * @param limit   nombre max de runs
     */
    public List<AuditHistoryItemResponse> getAuditHistory(long auditId, int limit) {
        logger.info("Listing audit history auditId={} limit={}", auditId, limit);

        List<Tuple> rows = auditDao.listRunsWithReportByAuditId(auditId, limit);

        return rows.stream().map(row -> {
            AuditRun run = row.get(0, AuditRun.class);
            AuditReport report = row.get(1, AuditReport.class);

            // Token depuis le rapport publié si présent, sinon le token pré-généré du run.
            String token = report != null ? report.getPublicToken() : run.getReportToken();
            String reportUrl = token != null ? REPORTS_BASE_PATH + token : null;
            Integer globalScore = report != null
                ? extractGlobalScore(objectMapper, report.getReportJson())
                : null;

            return new AuditHistoryItemResponse(
                run.getId(),
                run.getStatus(),
                run.getCreatedAt(),
                run.getFinishedAt(),
                token,
                reportUrl,
                globalScore
            );
        }).toList();
    }

    /**
     * Extrait le score global (0..100) du JSON d'un rapport publié (champ {@code scores.global}).
     * Robuste : retourne {@code null} si le JSON est absent, vide ou illisible.
     */
    static Integer extractGlobalScore(ObjectMapper objectMapper, String reportJson) {
        if (reportJson == null || reportJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(reportJson).path("scores").path("global");
            return node.isMissingNode() || node.isNull() ? null : node.asInt();
        } catch (Exception e) {
            return null;
        }
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

        // Trouver ou créer le domaine (one per hostname)
        Domain domain = domainService.findOrCreate(hostname);

        Audit audit = auditDao.findByNormalizedUrl(normalizedUrl)
            .orElseGet(() -> {
                logger.info("Creating new Audit for normalizedUrl={} domainId={}", normalizedUrl, domain.getId());
                Audit a = new Audit();
                a.setDomainId(domain.getId());
                a.setInputUrl(inputUrl);
                a.setNormalizedUrl(normalizedUrl);
                a.setCreatedAt(now);
                return auditDao.save(a);
            });

        AuditRun run = auditRunService.createQueuedRun(audit.getId(), now);

        logger.info("Run created: auditId={}, runId={}, status={}", audit.getId(), run.getId(), run.getStatus());

        return new CreateAuditResponse(
            run.getId(),
            run.getAuditId(),
            run.getStatus(),
            run.getCreatedAt(),
            run.getReportToken()
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
            run.getReportToken(),
            run.getModuleStatuses()
        );
    }
}
