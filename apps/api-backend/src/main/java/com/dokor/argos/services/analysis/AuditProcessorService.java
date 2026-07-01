package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.lighthouse.LighthouseModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.observatory.ObservatoryModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.runtime.RuntimeModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.ssl.SslLabsModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.zap.ZapModuleAnalyzer;
import com.dokor.argos.services.analysis.scoring.AuditScoreReport;
import com.dokor.argos.services.analysis.scoring.ScoreEnricherService;
import com.dokor.argos.services.analysis.scoring.ScoreService;
import com.dokor.argos.services.domain.audit.AuditRunService;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.dokor.argos.services.domain.report.ReportPublishService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;

@Singleton
public class AuditProcessorService {

    private static final Logger logger = LoggerFactory.getLogger(AuditProcessorService.class);

    // Version du schema du rapport
    private static final int REPORT_SCHEMA_VERSION = 5;

    private final AuditRunService auditRunService;
    private final AuditDao auditDao;
    private final UrlNormalizer urlNormalizer;

    private final HttpModuleAnalyzer httpModuleAnalyzer;
    private final HtmlModuleAnalyzer htmlModuleAnalyzer;
    private final RuntimeModuleAnalyzer runtimeModuleAnalyzer;
    private final LighthouseModuleAnalyzer lighthouseModuleAnalyzer;
    private final ObservatoryModuleAnalyzer observatoryModuleAnalyzer;
    private final SslLabsModuleAnalyzer sslLabsModuleAnalyzer;
    private final ZapModuleAnalyzer zapModuleAnalyzer;
    private final DomainAnalysisService domainAnalysisService;

    private final CheckMergerService checkMergerService;
    private final ScoreEnricherService scoreEnricherService;
    private final ScoreService scoreService;

    private final ObjectMapper objectMapper;

    private final ReportPublishService reportPublishService;

    @Inject
    public AuditProcessorService(
        AuditRunService auditRunService,
        AuditDao auditDao,
        UrlNormalizer urlNormalizer,
        HttpModuleAnalyzer httpModuleAnalyzer,
        HtmlModuleAnalyzer htmlModuleAnalyzer,
        RuntimeModuleAnalyzer runtimeModuleAnalyzer,
        LighthouseModuleAnalyzer lighthouseModuleAnalyzer,
        ObservatoryModuleAnalyzer observatoryModuleAnalyzer,
        SslLabsModuleAnalyzer sslLabsModuleAnalyzer,
        ZapModuleAnalyzer zapModuleAnalyzer,
        DomainAnalysisService domainAnalysisService,
        CheckMergerService checkMergerService,
        ScoreEnricherService scoreEnricherService,
        ScoreService scoreService,
        ObjectMapper objectMapper,
        ReportPublishService reportPublishService
    ) {
        this.auditRunService = auditRunService;
        this.auditDao = auditDao;
        this.urlNormalizer = urlNormalizer;
        this.httpModuleAnalyzer = httpModuleAnalyzer;
        this.htmlModuleAnalyzer = htmlModuleAnalyzer;
        this.runtimeModuleAnalyzer = runtimeModuleAnalyzer;
        this.lighthouseModuleAnalyzer = lighthouseModuleAnalyzer;
        this.observatoryModuleAnalyzer = observatoryModuleAnalyzer;
        this.sslLabsModuleAnalyzer = sslLabsModuleAnalyzer;
        this.zapModuleAnalyzer = zapModuleAnalyzer;
        this.domainAnalysisService = domainAnalysisService;
        this.checkMergerService = checkMergerService;
        this.scoreEnricherService = scoreEnricherService;
        this.scoreService = scoreService;
        this.objectMapper = objectMapper;
        this.reportPublishService = reportPublishService;
    }

    public void process(long runId) {
        logger.info("Processing runId={}", runId);

        var runOpt = auditRunService.getRun(runId);
        if (runOpt.isEmpty()) {
            logger.warn("Run not found runId={}", runId);
            return;
        }

        var run = runOpt.get();
        // Keep run reference accessible for reportPublishService (reportToken) and module status updates
        final long resolvedRunId = runId;

        Audit audit = Optional.ofNullable(auditDao.findById(run.getAuditId()))
            .orElseThrow(() -> new IllegalStateException("Audit not found: " + run.getAuditId()));

        String inputUrl = audit.getInputUrl();
        String normalizedUrl = audit.getNormalizedUrl();

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
            long domainId = audit.getDomainId();
            AuditContext context = new AuditContext(inputUrl, normalizedUrl, domainId);

            // --- Modules PAGE ---

            // HTTP (page-level : status, redirects, headers, body)
            logger.info("Running module={} runId={} url={}", httpModuleAnalyzer.moduleId(), runId, normalizedUrl);
            auditRunService.updateModuleStatus(runId, "http", "RUNNING");
            AuditModuleResult httpModule = annotateWithSource(httpModuleAnalyzer.analyze(context, logger));
            auditRunService.updateModuleStatus(runId, "http", "COMPLETED");

            // Enrichir le contexte avec les données HTTP (finalUrl, headers, body…)
            context = HttpModuleAnalyzer.enrichContext(context, httpModule);

            logger.info("Running module={} runId={} finalUrl={}", htmlModuleAnalyzer.moduleId(), runId, context.finalUrl());
            auditRunService.updateModuleStatus(runId, "html", "RUNNING");
            AuditModuleResult htmlModule = annotateWithSource(htmlModuleAnalyzer.analyze(context, logger));
            auditRunService.updateModuleStatus(runId, "html", "COMPLETED");

            logger.info("Running module={} runId={} finalUrl={}", runtimeModuleAnalyzer.moduleId(), runId, context.finalUrl());
            auditRunService.updateModuleStatus(runId, "runtime", "RUNNING");
            AuditModuleResult runtimeModule = annotateWithSource(runtimeModuleAnalyzer.analyze(context, logger));
            auditRunService.updateModuleStatus(runId, "runtime", "COMPLETED");

            logger.info("Running module={} runId={} finalUrl={}", lighthouseModuleAnalyzer.moduleId(), runId, context.finalUrl());
            auditRunService.updateModuleStatus(runId, "lighthouse", "RUNNING");
            AuditModuleResult lighthouseModule = annotateWithSource(lighthouseModuleAnalyzer.analyze(context, logger));
            auditRunService.updateModuleStatus(runId, "lighthouse", "COMPLETED");

            // --- Modules DOMAIN ---

            logger.info("Running module={} runId={} finalUrl={}", observatoryModuleAnalyzer.moduleId(), runId, context.finalUrl());
            auditRunService.updateModuleStatus(runId, "observatory", "RUNNING");
            AuditModuleResult observatoryModule = annotateWithSource(observatoryModuleAnalyzer.analyze(context, logger));
            auditRunService.updateModuleStatus(runId, "observatory", "COMPLETED");

            logger.info("Running module={} runId={} finalUrl={}", sslLabsModuleAnalyzer.moduleId(), runId, context.finalUrl());
            auditRunService.updateModuleStatus(runId, "ssl", "RUNNING");
            AuditModuleResult sslModule = annotateWithSource(sslLabsModuleAnalyzer.analyze(context, logger));
            auditRunService.updateModuleStatus(runId, "ssl", "COMPLETED");

            logger.info("Running module={} runId={} finalUrl={}", zapModuleAnalyzer.moduleId(), runId, context.finalUrl());
            auditRunService.updateModuleStatus(runId, "zap", "RUNNING");
            AuditModuleResult zapModule = annotateWithSource(zapModuleAnalyzer.analyze(context, logger));
            auditRunService.updateModuleStatus(runId, "zap", "COMPLETED");

            // --- Module DOMAIN (tech) — cache 24h partagé entre toutes les pages du domaine ---
            logger.info("Resolving domain tech analysis domainId={} runId={}", domainId, runId);
            auditRunService.updateModuleStatus(runId, "tech", "RUNNING");
            AuditModuleResult techModule = annotateWithSource(domainAnalysisService.getOrRunTechAnalysis(context, logger));
            auditRunService.updateModuleStatus(runId, "tech", "COMPLETED");

            List<AuditModuleResult> allModules = List.of(
                httpModule, htmlModule, runtimeModule, lighthouseModule,
                observatoryModule, sslModule, zapModule, techModule
            );

            // Merge cross-module duplicate checks
            List<AuditModuleResult> mergedModules = checkMergerService.merge(allModules);

            // Enrich checks (tags/scorable/weight) + compute score
            List<AuditModuleResult> enrichedModules = scoreEnricherService.enrich(mergedModules);
            int scoringVersion = scoreEnricherService.scoringVersion();
            AuditScoreReport score = scoreService.compute(scoringVersion, enrichedModules);

            Map<String, String> meta = new LinkedHashMap<>();
            meta.put("generator", "argos-api-backend");
            meta.put("schemaVersion", String.valueOf(REPORT_SCHEMA_VERSION));
            meta.put("scoringVersion", String.valueOf(scoringVersion));
            meta.put("runId", String.valueOf(runId));
            meta.put("httpStatusCode", String.valueOf(context.httpStatusCode()));
            meta.put("auditDurationMs", String.valueOf(Instant.now().toEpochMilli() - context.startedAt().toEpochMilli()));

            AuditReportJson report = new AuditReportJson(
                REPORT_SCHEMA_VERSION,
                inputUrl,
                normalizedUrl,
                Instant.now(),
                meta,
                enrichedModules,
                score
            );

            String json = objectMapper.writeValueAsString(report);

            auditRunService.complete(runId, json);
            // Publish public report (tokenized) for /report/[token]
            reportPublishService.publishIfAbsent(runId, audit, report, run.getReportToken())
                .ifPresentOrElse(
                    token -> logger.info("Public report ready runId={} token={}", runId, token),
                    () -> logger.warn("Public report not published runId={}", runId)
                );
            logger.info(
                "Run completed runId={} globalScoreRatio={}",
                runId,
                score.global().ratio()
            );
        } catch (Exception e) {
            auditRunService.fail(runId, e.getMessage());
            logger.warn("Run failed runId={} error={}", runId, e.getMessage(), e);
        }
    }

    /**
     * Annotates each check in the module with the module's own id as source,
     * unless the check already has sources set (e.g. from a merge).
     */
    private AuditModuleResult annotateWithSource(AuditModuleResult module) {
        List<AuditCheckResult> annotated = module.checks().stream()
            .map(c -> c.sources().isEmpty() ? c.withSources(List.of(module.id())) : c)
            .toList();
        return new AuditModuleResult(module.id(), module.title(), module.summary(), module.data(), annotated);
    }
}
