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
    private final ObjectMapper mapper;

    @Inject
    public ReportPublishService(TransactionManagerQuerydsl transactions, AuditRunDao runs,
        AuditReportDao reports, PublicReportComposer composer, AiReportSummaryService summaries, ObjectMapper mapper) {
        this.transactions = transactions; this.runs = runs; this.reports = reports;
        this.composer = composer; this.summaries = summaries; this.mapper = mapper;
    }

    public long completeAndPublish(long runId, Audit audit, AuditReportJson internal,
                                   String resultJson, String claimToken) {
        if (claimToken == null || claimToken.isBlank()) throw new IllegalArgumentException("Missing worker claim");
        // Composition, remote AI enrichment and serialization precede the database lock.
        ReportDto dto = summaries.enrich(composer.compose(internal));
        AuditReport entity = new AuditReport();
        entity.setAuditId(audit.getId()); entity.setRunId(runId);
        entity.setDomain(Urls.host(audit.getNormalizedUrl(), audit.getNormalizedUrl()));
        entity.setTargetUrl(audit.getNormalizedUrl());
        entity.setSiteTitle(dto.site() == null ? null : dto.site().title());
        entity.setLogoUrl(dto.site() == null ? null : dto.site().logoUrl());
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
}
