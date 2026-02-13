package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.db.generated.AuditReport;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Optional;

@Singleton
public class ReportReadService {

    private static final Logger logger = LoggerFactory.getLogger(ReportReadService.class);

    private final AuditReportDao auditReportDao;
    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

    @Inject
    public ReportReadService(
        AuditReportDao auditReportDao,
        TokenService tokenService,
        ObjectMapper objectMapper
    ) {
        this.auditReportDao = auditReportDao;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    public Optional<ReportDto> getByToken(String token) throws NoSuchAlgorithmException {
        if (token == null || token.isBlank()) return Optional.empty();

        byte[] hash = tokenService.sha256(token);

        return auditReportDao.findByTokenHash(hash)
            .filter(this::notExpired)
            .flatMap(this::deserialize);
    }

    private boolean notExpired(AuditReport entity) {
        if (entity.getExpiresAt() == null) return true;
        return entity.getExpiresAt().isAfter(Instant.now());
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
