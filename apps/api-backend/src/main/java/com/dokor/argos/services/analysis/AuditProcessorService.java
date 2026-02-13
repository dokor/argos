package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.tech.TechModuleAnalyzer;
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

    private static final int REPORT_SCHEMA_VERSION = 2;

    private final AuditRunService auditRunService;
    private final AuditDao auditDao;
    private final UrlNormalizer urlNormalizer;

    private final HttpModuleAnalyzer httpModuleAnalyzer;
    private final HtmlModuleAnalyzer htmlModuleAnalyzer;
    private final TechModuleAnalyzer techModuleAnalyzer;

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
        TechModuleAnalyzer techModuleAnalyzer,
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
        this.techModuleAnalyzer = techModuleAnalyzer;
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
            AuditContext context = new AuditContext(inputUrl, normalizedUrl);

            // HTTP
            logger.info("Running module={} runId={} url={}", httpModuleAnalyzer.moduleId(), runId, normalizedUrl);
            AuditModuleResult httpModule = httpModuleAnalyzer.analyze(context, logger);

            // Enrich context with HTTP output
            context = context.withHttpResult(
                (String) httpModule.data().get("finalUrl"),
                toInt(httpModule.data().get("statusCode")),
                toLong(httpModule.data().get("durationMs")),
                safeStringList(httpModule.data().get("redirectChain")),
                safeStringMap(httpModule.data().get("headers")),
                (String) httpModule.data().get("body")
            );

            // HTML + TECH
            logger.info("Running module={} runId={} finalUrl={}", htmlModuleAnalyzer.moduleId(), runId, context.finalUrl());
            AuditModuleResult htmlModule = htmlModuleAnalyzer.analyze(context, logger);

            logger.info("Running module={} runId={} finalUrl={}", techModuleAnalyzer.moduleId(), runId, context.finalUrl());
            AuditModuleResult techModule = techModuleAnalyzer.analyze(context, logger);

            List<AuditModuleResult> modules = List.of(httpModule, htmlModule, techModule);

            // Enrich checks (tags/scorable/weight) + compute score
            List<AuditModuleResult> enrichedModules = scoreEnricherService.enrich(modules);
            int scoringVersion = scoreEnricherService.scoringVersion();
            AuditScoreReport score = scoreService.compute(scoringVersion, enrichedModules);

            Map<String, String> meta = new LinkedHashMap<>();
            meta.put("generator", "argos-api-backend");
            meta.put("schemaVersion", String.valueOf(REPORT_SCHEMA_VERSION));
            meta.put("scoringVersion", String.valueOf(scoringVersion));
            meta.put("runId", String.valueOf(runId));
            meta.put("httpStatusCode", String.valueOf(context.httpStatusCode()));

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
            reportPublishService.publishIfAbsent(runId, audit, report)
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

    private static int toInt(Object o) {
        if (o instanceof Integer i) return i;
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s) return Integer.parseInt(s);
        return 0;
    }

    private static long toLong(Object o) {
        if (o instanceof Long l) return l;
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s) return Long.parseLong(s);
        return 0L;
    }

    @SuppressWarnings("unchecked")
    private static List<String> safeStringList(Object o) {
        if (o instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> safeStringMap(Object o) {
        if (o instanceof Map<?, ?> map) {
            Map<String, String> out = new LinkedHashMap<>();
            map.forEach((k, v) -> out.put(String.valueOf(k), v != null ? String.valueOf(v) : null));
            return out;
        }
        return Map.of();
    }
}
