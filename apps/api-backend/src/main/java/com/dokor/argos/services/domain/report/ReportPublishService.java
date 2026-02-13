package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.time.Instant;
import java.util.Optional;

@Singleton
public class ReportPublishService {

    private static final Logger logger = LoggerFactory.getLogger(ReportPublishService.class);

    private final AuditReportDao auditReportDao;
    private final TokenService tokenService;
    private final PublicReportComposer composer;
    private final ObjectMapper objectMapper;

    @Inject
    public ReportPublishService(
        AuditReportDao auditReportDao,
        TokenService tokenService,
        PublicReportComposer composer,
        ObjectMapper objectMapper
    ) {
        this.auditReportDao = auditReportDao;
        this.tokenService = tokenService;
        this.composer = composer;
        this.objectMapper = objectMapper;
    }

    /**
     * Publie un report "public" pour un run COMPLETED.
     * Idempotent: si déjà publié pour runId, renvoie le token existant.
     *
     * @return token public (base64url)
     */
    public Optional<String> publishIfAbsent(long runId, Audit audit, AuditReportJson internalReport) {
        // 1) déjà publié ?
        var existing = auditReportDao.findByRunId(runId);
        if (existing.isPresent()) {
            logger.info("Report already published runId={} reportId={}", runId, existing.get().getId());
            return Optional.ofNullable(existing.get().getPublicToken());
        }

        try {
            // 2) Build public DTO
            ReportDto dto = composer.compose(internalReport);

            // Option : injecter title/logo si tu les as déjà ailleurs
            // dto.site.title/logoUrl seront enrichis plus tard

            String reportJson = objectMapper.writeValueAsString(dto);

            String token = tokenService.generateToken();
            byte[] hash = tokenService.sha256(token);

            String url = audit.getNormalizedUrl();
            String domain = extractDomain(url);

            // 3) Persist
            AuditReport entity = new AuditReport();
            entity.setAuditId(audit.getId());
            entity.setRunId(runId);

            entity.setPublicToken(token);
            entity.setTokenHash(hash);

            entity.setDomain(domain);
            entity.setTargetUrl(url);
            entity.setSiteTitle(dto.site() != null ? dto.site().title() : null);
            entity.setLogoUrl(dto.site() != null ? dto.site().logoUrl() : null);

            entity.setReportJson(reportJson);
            entity.setCreatedAt(Instant.now());
            entity.setExpiresAt(null);

            AuditReport saved = auditReportDao.save(entity);

            logger.info("Report published runId={} reportId={} domain={} token={}",
                runId, saved.getId(), domain, safeToken(token)
            );

            return Optional.of(token);
        } catch (Exception e) {
            logger.warn("Report publish failed runId={} auditId={} error={}", runId, audit.getId(), e.getMessage(), e);
            return Optional.empty();
        }
    }

    private static String extractDomain(String url) {
        try {
            return URI.create(url).getHost();
        } catch (Exception e) {
            return url;
        }
    }

    private static String safeToken(String token) {
        if (token == null) return "null";
        return token.length() <= 8 ? "****" : token.substring(0, 4) + "…" + token.substring(token.length() - 4);
    }
}
