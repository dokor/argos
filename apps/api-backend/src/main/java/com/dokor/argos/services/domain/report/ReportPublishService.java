package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.util.Urls;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    @Inject
    public ReportPublishService(TransactionManagerQuerydsl transactions, AuditRunDao runs,
        AuditReportDao reports, PublicReportComposer composer, AiReportSummaryService summaries,
        AhrefsDomainRatingClient domainRatings, ObjectMapper mapper) {
        this.transactions = transactions; this.runs = runs; this.reports = reports;
        this.composer = composer; this.summaries = summaries; this.domainRatings = domainRatings; this.mapper = mapper;
    }

    public long completeAndPublish(long runId, Audit audit, AuditReportJson internal,
                                   String resultJson, String claimToken) {
        if (claimToken == null || claimToken.isBlank()) throw new IllegalArgumentException("Missing worker claim");
        // Composition, remote AI enrichment and serialization precede the database lock.
        ReportDto composed = summaries.enrich(composer.compose(internal));
        ReportDto.DomainRating rating = domainRatings.get(composed.domain());
        ReportDto.Site site = composed.site();
        ReportDto dto = new ReportDto(composed.generatedAt(), composed.domain(), composed.url(),
            new ReportDto.Site(site == null ? null : site.title(), site == null ? null : site.logoUrl(), rating),
            composed.scores(), composed.summary(), composed.issues(), composed.tech(), composed.antiBot(),
            composed.accessibilityEvidence(), composed.accessibilityCompliance());
        Integer globalScore = publishedGlobalScore(internal, dto);
        AuditReport entity = new AuditReport();
        entity.setAuditId(audit.getId()); entity.setRunId(runId);
        entity.setDomain(Urls.host(audit.getNormalizedUrl(), audit.getNormalizedUrl()));
        entity.setTargetUrl(audit.getNormalizedUrl());
        entity.setSiteTitle(dto.site() == null ? null : dto.site().title());
        entity.setLogoUrl(dto.site() == null ? null : dto.site().logoUrl());
        entity.setGlobalScore(globalScore);
        entity.setScoringVersion(globalScore == null ? null : internal.score().scoringVersion());
        try { entity.setReportJson(mapper.writeValueAsString(dto)); }
        catch (Exception error) { throw new IllegalStateException("Report serialization failed", error); }
        entity.setCreatedAt(Instant.now());

        return transactions.executeAndReturn(connection -> {
            var run = runs.lockForPublication(runId, connection).orElseThrow(() -> new IllegalStateException("Run missing"));
            if (!Objects.equals(run.getAuditId(), audit.getId()) || !claimToken.equals(run.getClaimToken())) {
                throw new IllegalStateException("Worker no longer owns this run");
            }
            var existing = reports.findByRunId(runId, connection);
            if ("COMPLETED".equals(run.getStatus()) && existing.isPresent()) return existing.get().getId();
            if (!"RUNNING".equals(run.getStatus()) || existing.isPresent()) throw new IllegalStateException("Run cannot be published");
            byte[] hash = run.getReportTokenHash();
            if (hash == null || hash.length != 32) throw new IllegalStateException("Missing report credential hash");
            entity.setTokenHash(hash);
            long reportId = reports.save(entity, connection).getId();
            if (!runs.markCompleted(runId, claimToken, Instant.now(), resultJson, connection)) {
                throw new IllegalStateException("Run completion rejected");
            }
            return reportId;
        });
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
