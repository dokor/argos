package com.dokor.argos.services.domain.report;

import com.dokor.argos.util.Urls;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Optional;

@Singleton
public class ReportPublishService {

    private static final Logger logger = LoggerFactory.getLogger(ReportPublishService.class);

    private final AuditReportDao auditReportDao;
    private final PublicReportComposer composer;
    private final AiReportSummaryService aiReportSummaryService;
    private final ObjectMapper objectMapper;

    @Inject
    public ReportPublishService(
        AuditReportDao auditReportDao,
        PublicReportComposer composer,
        AiReportSummaryService aiReportSummaryService,
        ObjectMapper objectMapper
    ) {
        this.auditReportDao = auditReportDao;
        this.composer = composer;
        this.aiReportSummaryService = aiReportSummaryService;
        this.objectMapper = objectMapper;
    }

    /**
     * Publie un report "public" pour un run COMPLETED.
     * Idempotent: si déjà publié pour runId, renvoie son identifiant.
     *
     * @return identifiant du rapport publié, sans reconstruire de credential
     */
    public Optional<Long> publishIfAbsent(long runId, Audit audit, AuditReportJson internalReport, byte[] reportTokenHash) {
        // 1) déjà publié ?
        var existing = auditReportDao.findByRunId(runId);
        if (existing.isPresent()) {
            logger.info("Report already published runId={} reportId={}", runId, existing.get().getId());
            return Optional.ofNullable(existing.get().getId());
        }

        try {
            // 2) Build public DTO
            ReportDto dto = aiReportSummaryService.enrich(composer.compose(internalReport));

            // Option : injecter title/logo si tu les as déjà ailleurs
            // dto.site.title/logoUrl seront enrichis plus tard

            String reportJson = objectMapper.writeValueAsString(dto);

            if (reportTokenHash == null || reportTokenHash.length != 32) throw new IllegalArgumentException("Missing report credential hash");
            String url = audit.getNormalizedUrl();
            String domain = Urls.host(url, url);

            // 3) Persist
            AuditReport entity = new AuditReport();
            entity.setAuditId(audit.getId());
            entity.setRunId(runId);

            entity.setTokenHash(reportTokenHash);

            entity.setDomain(domain);
            entity.setTargetUrl(url);
            entity.setSiteTitle(dto.site() != null ? dto.site().title() : null);
            entity.setLogoUrl(dto.site() != null ? dto.site().logoUrl() : null);

            entity.setReportJson(reportJson);
            entity.setCreatedAt(Instant.now());
            entity.setExpiresAt(null);

            AuditReport saved = auditReportDao.save(entity);

            logger.info("Report published runId={} reportId={} domain={}",
                runId, saved.getId(), domain
            );

            return Optional.of(saved.getId());
        } catch (Exception e) {
            logger.warn("Report publish failed runId={} auditId={} error={}", runId, audit.getId(), e.getMessage(), e);
            return Optional.empty();
        }
    }

}
