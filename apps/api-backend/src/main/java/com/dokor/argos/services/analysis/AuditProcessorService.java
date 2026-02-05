package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

@Singleton
public class AuditProcessorService {

    private static final Logger logger = LoggerFactory.getLogger(AuditProcessorService.class);

    private final AuditRunService auditRunService;
    private final AuditDao auditDao;
    private final UrlAuditAnalyzer analyzer;
    private final ObjectMapper objectMapper;

    @Inject
    public AuditProcessorService(
        AuditRunService auditRunService,
        AuditDao auditDao,
        UrlAuditAnalyzer analyzer,
        ObjectMapper objectMapper
    ) {
        this.auditRunService = auditRunService;
        this.auditDao = auditDao;
        this.analyzer = analyzer;
        this.objectMapper = objectMapper;
    }

    public void process(long runId) {
        logger.info("Processing runId={}", runId);

        // (MVP) on suppose qu’un worker appelle ce process(runId)
        // Plus tard: claimNextQueued()

        var runOpt = auditRunService.getRun(runId);
        if (runOpt.isEmpty()) {
            logger.warn("Run not found runId={}", runId);
            return;
        }

        var run = runOpt.get();

        // Récupère l’audit pour avoir l’URL à analyser
        Audit audit = Optional.ofNullable(auditDao.findById(run.getAuditId()))
            .orElseThrow(() -> new IllegalStateException("Audit not found: " + run.getAuditId()));

        try {
            UrlAuditResult result = analyzer.analyze(audit.getNormalizedUrl());
            String json = objectMapper.writeValueAsString(result);

            auditRunService.complete(runId, json);
            logger.info("Run completed runId={}", runId);
        } catch (Exception e) {
            auditRunService.fail(runId, e.getMessage());
            logger.warn("Run failed runId={} error={}", runId, e.getMessage(), e);
        }
    }
}
