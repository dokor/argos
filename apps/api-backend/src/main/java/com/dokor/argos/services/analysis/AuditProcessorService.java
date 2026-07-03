package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.services.analysis.lighthouse.LighthouseModuleAnalyzer;
import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
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

import java.net.http.HttpTimeoutException;
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

        Audit audit = auditDao.findById(run.getAuditId());
        if (audit == null) {
            auditRunService.fail(runId, "Audit not found: " + run.getAuditId());
            logger.warn("Run failed (audit not found) runId={} auditId={}", runId, run.getAuditId());
            return;
        }

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

            // Statut par module : COMPLETED / UNAVAILABLE / TIMEOUT / FAILED.
            // Chaque module est exécuté de façon isolée : un timeout ou une erreur
            // n'interrompt plus tout l'audit — on poursuit en mode dégradé avec un
            // rapport partiel. Le détail est exposé dans meta.moduleStatuses / meta.degraded.
            Map<String, String> moduleStatuses = new LinkedHashMap<>();

            // --- Modules PAGE ---

            // HTTP (page-level : status, redirects, headers, body)
            final AuditContext baseContext = context;
            AuditModuleResult httpModule = runModule(
                "http", "HTTP", moduleStatuses,
                () -> httpModuleAnalyzer.analyze(baseContext, logger));

            // Enrichir le contexte avec les données HTTP (finalUrl, headers, body…)
            context = HttpModuleAnalyzer.enrichContext(context, httpModule);
            final AuditContext ctx = context;

            AuditModuleResult htmlModule = runModule(
                "html", "HTML", moduleStatuses,
                () -> htmlModuleAnalyzer.analyze(ctx, logger));

            AuditModuleResult runtimeModule = runModule(
                "runtime", "Runtime (Playwright)", moduleStatuses,
                () -> runtimeModuleAnalyzer.analyze(ctx, logger));

            AuditModuleResult lighthouseModule = runModule(
                "lighthouse", "Lighthouse", moduleStatuses,
                () -> lighthouseModuleAnalyzer.analyze(ctx, logger));

            // --- Modules DOMAIN ---

            AuditModuleResult observatoryModule = runModule(
                "observatory", "Observatory", moduleStatuses,
                () -> observatoryModuleAnalyzer.analyze(ctx, logger));

            AuditModuleResult sslModule = runModule(
                "ssl", "SSL Labs", moduleStatuses,
                () -> sslLabsModuleAnalyzer.analyze(ctx, logger));

            AuditModuleResult zapModule = runModule(
                "zap", "OWASP ZAP", moduleStatuses,
                () -> zapModuleAnalyzer.analyze(ctx, logger));

            // --- Module DOMAIN (tech) — cache 24h partagé entre toutes les pages du domaine ---
            AuditModuleResult techModule = runModule(
                "tech", "Tech stack", moduleStatuses,
                () -> domainAnalysisService.getOrRunTechAnalysis(ctx, logger));

            List<AuditModuleResult> allModules = List.of(
                httpModule, htmlModule, runtimeModule, lighthouseModule,
                observatoryModule, sslModule, zapModule, techModule
            );

            boolean degraded = moduleStatuses.values().stream()
                .anyMatch(st -> !"COMPLETED".equals(st));
            if (degraded) {
                logger.warn("Run degraded runId={} moduleStatuses={}", runId, moduleStatuses);
            }

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
            meta.put("degraded", String.valueOf(degraded));
            meta.put("moduleStatuses", objectMapper.writeValueAsString(moduleStatuses));

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

    @FunctionalInterface
    private interface ModuleCall {
        AuditModuleResult run() throws Exception;
    }

    /**
     * Exécute un module de façon isolée (mode dégradé).
     * <p>
     * Une erreur (timeout, service indisponible, résultat {@code null}…) n'interrompt
     * pas l'audit : le statut du module est enregistré (COMPLETED / UNAVAILABLE /
     * TIMEOUT / FAILED) et, en cas d'échec, un résultat "indisponible" (WARN, non
     * scorable) est substitué afin que le reste de l'analyse se poursuive.
     */
    private AuditModuleResult runModule(String moduleId, String title,
                                        Map<String, String> statuses, ModuleCall call) {
        logger.info("Running module={}", moduleId);
        try {
            AuditModuleResult raw = call.run();
            if (raw == null) {
                statuses.put(moduleId, "FAILED");
                logger.warn("Module {} returned null -> mode dégradé", moduleId);
                return annotateWithSource(fallbackModule(moduleId, title, false,
                    new IllegalStateException("module returned null")));
            }
            AuditModuleResult res = annotateWithSource(raw);
            Map<String, Object> data = res.data();
            if (data != null && Boolean.FALSE.equals(data.get("available"))) {
                Object reason = data.get("reason");
                statuses.put(moduleId, reason != null ? reason.toString() : "UNAVAILABLE");
            } else {
                statuses.put(moduleId, "COMPLETED");
            }
            return res;
        } catch (Exception e) {
            boolean timeout = isTimeout(e);
            statuses.put(moduleId, timeout ? "TIMEOUT" : "FAILED");
            logger.warn("Module {} unavailable ({}) error={}", moduleId,
                timeout ? "timeout" : "failed", e.getMessage(), e);
            return annotateWithSource(fallbackModule(moduleId, title, timeout, e));
        }
    }

    /** Détecte un timeout HTTP en remontant la chaîne des causes (bornée pour éviter les cycles). */
    private static boolean isTimeout(Throwable e) {
        Throwable t = e;
        for (int i = 0; t != null && i < 12; i++, t = t.getCause()) {
            if (t instanceof HttpTimeoutException) {
                return true;
            }
            String msg = t.getMessage();
            if (msg != null && msg.toLowerCase(Locale.ROOT).contains("timeout")) {
                return true;
            }
        }
        return false;
    }

    /** Résultat "module indisponible" substitué en mode dégradé (WARN, non bloquant, non scorable). */
    private static AuditModuleResult fallbackModule(String moduleId, String title, boolean timeout, Exception e) {
        String reason = timeout ? "TIMEOUT" : "FAILED";
        String message = timeout
            ? "Module « " + title + " » indisponible : délai d'attente dépassé (timeout)."
            : "Module « " + title + " » indisponible suite à une erreur technique.";
        AuditCheckResult check = AuditCheckResult.of(
            moduleId + ".collect",
            title + " (indisponible)",
            AuditStatus.WARN,
            AuditSeverity.MEDIUM,
            false, 0.0, List.of(moduleId),
            false,
            Map.of("error", safeMsg(e), "reason", reason),
            message,
            "Relancer l'analyse ; si le problème persiste, vérifier la disponibilité du service concerné."
        );
        return new AuditModuleResult(
            moduleId,
            title,
            moduleId + "=unavailable(" + reason.toLowerCase(Locale.ROOT) + ")",
            Map.of("available", false, "error", safeMsg(e), "reason", reason),
            List.of(check)
        );
    }

    private static String safeMsg(Throwable e) {
        String m = e.getMessage();
        return (m == null || m.isBlank()) ? e.getClass().getSimpleName() : m;
    }
}
