package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Optional;

@Singleton
public class ReportReadService {

    private static final Logger logger = LoggerFactory.getLogger(ReportReadService.class);

    private final AuditReportDao auditReportDao;
    private final TokenService tokenService;
    private final ObjectMapper objectMapper;
    private final ReportRetentionPolicy retention;

    public ReportReadService(AuditReportDao reports, TokenService tokens, ObjectMapper mapper) {
        this(reports, tokens, mapper, ReportRetentionPolicy.defaults());
    }

    @Inject
    public ReportReadService(
        AuditReportDao auditReportDao,
        TokenService tokenService,
        ObjectMapper objectMapper, ReportRetentionPolicy retention
    ) {
        this.auditReportDao = auditReportDao;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
        this.retention = retention;
    }

    public Optional<ReportDto> getByToken(String token) {
        if (token == null || token.isBlank() || token.length() > 512) return Optional.empty();

        byte[] hash = tokenService.sha256(token);
        return auditReportDao.findByTokenHash(hash)
            .filter(entity -> entity.getTokenHash() != null && java.security.MessageDigest.isEqual(hash, entity.getTokenHash()))
            .filter(this::notExpired)
            .flatMap(this::deserialize);
    }

    public Optional<ReportDto> getByRunId(long runId) {
        return auditReportDao.findByRunId(runId).filter(this::notExpired).flatMap(this::deserialize);
    }

    /** Pending runs have no report yet; published expiry also revokes polling. */
    public boolean isExpired(long runId) {
        return auditReportDao.findByRunId(runId).map(entity -> !notExpired(entity)).orElse(false);
    }

    private boolean notExpired(AuditReport entity) {
        return !retention.expired(entity, Instant.now());
    }

    private Optional<ReportDto> deserialize(AuditReport entity) {
        try {
            return Optional.of(objectMapper.readValue(entity.getReportJson(), ReportDto.class));
        } catch (Exception e) {
            logger.warn("Invalid report_json reportId={}", entity.getId(), e);
            // sécurité : 404 plutôt que 500 (évite leak)
            return Optional.empty();
        }
    }
}
