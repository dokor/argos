package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditReport;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Orchestrateur d'analyse (MVP).
 *
 * Responsabilités :
 * - charger l'Audit + l'AuditRun
 * - exécuter les modules d'analyse (HTTP puis HTML, etc.)
 * - assembler un AuditReport canonique (PDF/score friendly)
 * - sérialiser en JSON et persister dans AuditRun.resultJson via AuditRunService
 *
 * Remarques :
 * - Ici on reste simple : process(runId) est appelé par un worker/scheduler.
 * - Plus tard : claimNextQueued() et exécution multi-worker.
 */
@Singleton
public class AuditProcessorService {

    private static final Logger logger = LoggerFactory.getLogger(AuditProcessorService.class);

    // Version de schéma du JSON produit (utile pour migrations/scoring dans le futur)
    private static final int REPORT_SCHEMA_VERSION = 1;

    private final AuditRunService auditRunService;
    private final AuditDao auditDao;
    private final UrlNormalizer urlNormalizer;

    private final HttpModuleAnalyzer httpModuleAnalyzer;
    private final HtmlModuleAnalyzer htmlModuleAnalyzer;

    private final ObjectMapper objectMapper;

    @Inject
    public AuditProcessorService(
        AuditRunService auditRunService,
        AuditDao auditDao,
        UrlNormalizer urlNormalizer,
        HttpModuleAnalyzer httpModuleAnalyzer,
        HtmlModuleAnalyzer htmlModuleAnalyzer,
        ObjectMapper objectMapper
    ) {
        this.auditRunService = auditRunService;
        this.auditDao = auditDao;
        this.urlNormalizer = urlNormalizer;
        this.httpModuleAnalyzer = httpModuleAnalyzer;
        this.htmlModuleAnalyzer = htmlModuleAnalyzer;
        this.objectMapper = objectMapper;
    }

    public void process(long runId) {
        logger.info("Processing runId={}", runId);

        // (MVP) on suppose qu’un worker appelle ce process(runId)
        // Plus tard: claimNextQueued() / multi-worker

        var runOpt = auditRunService.getRun(runId);
        if (runOpt.isEmpty()) {
            logger.warn("Run not found runId={}", runId);
            return;
        }

        var run = runOpt.get();

        // Récupère l’audit pour avoir l’URL à analyser
        Audit audit = Optional.ofNullable(auditDao.findById(run.getAuditId()))
            .orElseThrow(() -> new IllegalStateException("Audit not found: " + run.getAuditId()));

        String inputUrl = audit.getInputUrl();
        String normalizedUrl = audit.getNormalizedUrl();

        // Sécurité : si jamais normalizedUrl n'existe pas (ou si tu changes la logique plus tard)
        if (normalizedUrl == null || normalizedUrl.isBlank()) {
            try {
                normalizedUrl = urlNormalizer.normalize(inputUrl);
                logger.info("Normalized URL computed inputUrl={} normalizedUrl={}", inputUrl, normalizedUrl);
            } catch (Exception e) {
                auditRunService.fail(runId, "URL normalization failed: " + e.getMessage());
                logger.warn("Run failed (normalization) runId={} error={}", runId, e.getMessage(), e);
                return;
            }
        }

        try {
            // ---- 1) HTTP module ----
            logger.info("Running module={} runId={} url={}", httpModuleAnalyzer.moduleId(), runId, normalizedUrl);
            AuditModuleResult httpModule = httpModuleAnalyzer.analyze(inputUrl, normalizedUrl, logger);

            String finalUrl = (String) httpModule.data().get("finalUrl");
            String htmlBody = extractHtmlBodyOrNull(httpModule);

            // ---- 2) HTML module ----
            logger.info("Running module={} runId={} finalUrl={}", htmlModuleAnalyzer.moduleId(), runId, finalUrl);
            AuditModuleResult htmlModule = htmlModuleAnalyzer.analyzeHtml(
                inputUrl,
                normalizedUrl,
                finalUrl,
                htmlBody,
                logger
            );

            // ---- 3) Build canonical report ----
            Map<String, String> meta = new LinkedHashMap<>();
            meta.put("generator", "argos-api-backend");
            meta.put("schemaVersion", String.valueOf(REPORT_SCHEMA_VERSION));
            meta.put("runId", String.valueOf(runId));

            // On peut aussi y mettre des infos du module HTTP (utile pour debug)
            Object statusCode = httpModule.data().get("statusCode");
            if (statusCode != null) {
                meta.put("httpStatusCode", String.valueOf(statusCode));
            }

            AuditReport report = new AuditReport(
                REPORT_SCHEMA_VERSION,
                inputUrl,
                normalizedUrl,
                Instant.now(),
                meta,
                List.of(httpModule, htmlModule)
            );

            String json = objectMapper.writeValueAsString(report);

            auditRunService.complete(runId, json);
            logger.info(
                "Run completed runId={} modules={} checksTotal={}",
                runId,
                report.modules().size(),
                report.modules().stream().mapToInt(m -> m.checks() != null ? m.checks().size() : 0).sum()
            );
        } catch (Exception e) {
            auditRunService.fail(runId, e.getMessage());
            logger.warn("Run failed runId={} error={}", runId, e.getMessage(), e);
        }
    }

    /**
     * Extrait le body HTML depuis le module HTTP si présent.
     *
     * MVP :
     * - Notre HttpModuleAnalyzer stocke dans data: "body" = String (la réponse finale non-3xx)
     * - Si absent, le HtmlModuleAnalyzer renverra un module warning "HTML not provided".
     */
    private static String extractHtmlBodyOrNull(AuditModuleResult httpModule) {
        if (httpModule == null || httpModule.data() == null) {
            return null;
        }
        Object body = httpModule.data().get("body");
        if (body instanceof String s && !s.isBlank()) {
            return s;
        }
        return null;
    }
}
