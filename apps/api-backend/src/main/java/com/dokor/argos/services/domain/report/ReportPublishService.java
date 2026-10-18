package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.dao.ProblemStatisticsDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.scoring.DefaultScorePolicy;
import com.dokor.argos.services.analysis.scoring.ScorePolicy;
import com.dokor.argos.services.statistics.ProblemProjection;
import com.dokor.argos.util.Urls;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.Instant;
import java.util.Objects;

/** A durable COMPLETED run and its report are committed on the same JDBC connection. */
@Singleton
public class ReportPublishService {
    private final TransactionManagerQuerydsl transactions;
    private final AuditRunDao runs;
    private final AuditReportDao reports;
    private final PublicReportComposer composer;
    private final AiReportSummaryService summaries;
    private final AhrefsDomainRatingClient domainRatings;
    private final ObjectMapper mapper;
    private final ReportRetentionPolicy retention;
    private final ProblemStatisticsDao problemStatistics;
    private final ScorePolicy scorePolicy;

    public ReportPublishService(TransactionManagerQuerydsl transactions, AuditRunDao runs,
        AuditReportDao reports, PublicReportComposer composer, AiReportSummaryService summaries,
        AhrefsDomainRatingClient domainRatings, ObjectMapper mapper) {
        this(transactions, runs, reports, composer, summaries, domainRatings, mapper, ReportRetentionPolicy.defaults());
    }
    public ReportPublishService(TransactionManagerQuerydsl transactions, AuditRunDao runs,
        AuditReportDao reports, PublicReportComposer composer, AiReportSummaryService summaries,
        AhrefsDomainRatingClient domainRatings, ObjectMapper mapper, ReportRetentionPolicy retention) {
        this(transactions,runs,reports,composer,summaries,domainRatings,mapper,retention,
            new ProblemStatisticsDao(transactions),new DefaultScorePolicy());
    }
    @Inject
    public ReportPublishService(TransactionManagerQuerydsl transactions, AuditRunDao runs,
        AuditReportDao reports, PublicReportComposer composer, AiReportSummaryService summaries,
        AhrefsDomainRatingClient domainRatings, ObjectMapper mapper, ReportRetentionPolicy retention,
        ProblemStatisticsDao problemStatistics, ScorePolicy scorePolicy) {
        this.problemStatistics=problemStatistics; this.scorePolicy=scorePolicy;
        this.retention = retention;
        this.transactions = transactions; this.runs = runs; this.reports = reports;
        this.composer = composer; this.summaries = summaries; this.domainRatings = domainRatings; this.mapper = mapper;
    }

    public long completeAndPublish(long runId, Audit audit, AuditReportJson internal,
                                   String resultJson, String claimToken) {
        if (claimToken == null || claimToken.isBlank()) throw new IllegalArgumentException("Missing worker claim");
        boolean ciPrivate=reports.isCiPrivate(runId);
        // CI never sends customer findings to optional enrichment providers.
        ReportDto base=composer.compose(internal);
        ReportDto composed = ciPrivate ? base : summaries.enrich(base);
        ReportDto.DomainRating rating = ciPrivate ? null : domainRatings.get(composed.domain());
        ReportDto.Site site = composed.site();
        ReportDto dto = new ReportDto(composed.generatedAt(), composed.domain(), composed.url(),
            new ReportDto.Site(site == null ? null : site.title(), site == null ? null : site.logoUrl(), rating),
            composed.scores(), composed.summary(), composed.issues(), composed.tech(), composed.antiBot(),
            composed.accessibilityEvidence(), composed.accessibilityCompliance()).withPageIdentity(composed.pageIdentity()).withMeasurements(composed.measurements());
        Integer globalScore = publishedGlobalScore(internal, dto);
        AuditReport entity = new AuditReport();
        entity.setAuditId(audit.getId()); entity.setRunId(runId);
        entity.setDomain(Urls.host(audit.getNormalizedUrl(), audit.getNormalizedUrl()));
        entity.setTargetUrl(audit.getNormalizedUrl());
        entity.setSiteTitle(ciPrivate || dto.site() == null ? null : dto.site().title());
        entity.setLogoUrl(ciPrivate || dto.site() == null ? null : dto.site().logoUrl());
        entity.setGlobalScore(globalScore);
        entity.setProvisional(dto.scores()==null || dto.scores().coverage()==null ? null : dto.scores().coverage().provisional());
        entity.setScoringVersion(globalScore == null ? null : internal.score().scoringVersion());
        try { entity.setReportJson(mapper.writeValueAsString(com.dokor.argos.services.analysis.AuditOutputSanitizer.tree(dto, mapper))); }
        catch (Exception error) { throw new IllegalStateException("Report serialization failed", error); }
        final JsonNode publishedReport;
        try {
            publishedReport=mapper.readTree(entity.getReportJson());
            var diagnostic=com.dokor.argos.services.connected.summary.DiagnosticProjection.from(publishedReport,mapper.valueToTree(internal.score()));
            entity.setDiagnosticJson(mapper.writeValueAsString(diagnostic));
            entity.setCriticalCount(diagnostic.criticalCount()==null?null:Math.toIntExact(diagnostic.criticalCount()));
            entity.setImportantCount(diagnostic.importantCount()==null?null:Math.toIntExact(diagnostic.importantCount()));
        } catch (java.io.IOException invalid) { throw new IllegalStateException("Diagnostic projection failed",invalid); }
        entity.setMeasurementCompleteness(ReportCompleteness.from(dto));
        entity.setCreatedAt(Instant.now());
        entity.setExpiresAt(ciPrivate ? retention.ciExpiresAt(entity.getCreatedAt()) : retention.expiresAt(entity.getCreatedAt()));
        if(ciPrivate) {
            try {
                String projection=mapper.writeValueAsString(com.dokor.argos.services.ci.CiExportProjection.from(publishedReport));
                if(projection.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>com.dokor.argos.services.ci.CiExportProjection.MAX_BYTES)
                    throw new IllegalArgumentException();
                entity.setCiExportJson(projection);
                entity.setDiagnosticJson(null);
                // No raw report/collector evidence retained for a CI run.
                entity.setReportJson("{}");
            }catch(Exception invalid){throw new IllegalStateException("CI export projection failed");}
        }
        var problemProjection = ProblemProjection.from(publishedReport,scorePolicy);

        long outcome = transactions.executeAndReturn(connection -> {
            var run = runs.lockForPublication(runId, connection).orElseThrow(() -> new IllegalStateException("Run missing"));
            if(ciPrivate!=(run.getCiNavigationOrigins()!=null))throw new IllegalStateException("Run visibility changed");
            if (!Objects.equals(run.getAuditId(), audit.getId()) || !claimToken.equals(run.getClaimToken())) {
                throw new IllegalStateException("Worker no longer owns this run");
            }
            var existing = reports.findByRunId(runId, connection);
            if ("COMPLETED".equals(run.getStatus()) && existing.isPresent()) return existing.get().getId();
            if (!"RUNNING".equals(run.getStatus()) || existing.isPresent()) throw new IllegalStateException("Run cannot be published");
            if(Boolean.TRUE.equals(run.getCancelRequested())) {runs.finishCanceled(run,Instant.now(),connection);return 0L;}
            byte[] hash = run.getReportTokenHash();
            if (hash == null || hash.length != 32) throw new IllegalStateException("Missing report credential hash");
            entity.setTokenHash(hash);
            long reportId = reports.save(entity, connection).getId();
            if(!ciPrivate) problemStatistics.write(reportId,problemProjection,connection);
            if (!runs.markCompleted(runId, claimToken, Instant.now(), ciPrivate ? null : resultJson, connection)) {
                throw new IllegalStateException("Run completion rejected");
            }
            runs.recordBatchCompleteness(runId,ReportCompleteness.from(dto),connection);
            if(run.getOwnerUserId()!=null) runs.usage().published(run,entity.getCreatedAt(),connection);
            return reportId;
        });
        if(outcome==0) throw new com.dokor.argos.services.domain.audit.RunCanceledException();
        return outcome;
    }

    static Integer publishedGlobalScore(AuditReportJson internal, ReportDto report) {
        if (report.scores() == null) return null;
        var score = internal.score();
        var calculation = report.scores().calculation();
        if (calculation != null && (score == null
            || calculation.scoringVersion() != score.scoringVersion()
            || !Objects.equals(calculation.scoringFingerprint(), score.scoringFingerprint()))) {
            throw new IllegalStateException("Published scoring method differs from the audit score");
        }
        if (!Boolean.TRUE.equals(report.scores().globalAvailable()) || calculation == null) return null;
        int value = report.scores().global();
        if (value < 0 || value > 100 || score == null || score.global() == null
            || value != (int) Math.round(Math.max(0, Math.min(1, score.global().ratio())) * 100)) {
            throw new IllegalStateException("Published global score differs from the audit score");
        }
        return value;
    }
}
