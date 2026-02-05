package com.dokor.argos.services.domain;

import com.dokor.argos.db.dao.AuditRunDao;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Singleton
public class AuditRunService {
    private static final Logger logger = LoggerFactory.getLogger(AuditRunService.class);

    private final AuditRunDao auditRunDao;

    @Inject
    public AuditRunService(AuditRunDao auditRunDao) {
        this.auditRunDao = auditRunDao;
    }

    /**
     * Tente de claim un run pour traitement.
     * Utilisé par un worker.
     */
    public Optional<String> claim(long runId) {
        String token = UUID.randomUUID().toString().replace("-", "");

        logger.debug("Attempting to claim runId={} with token={}", runId, token);

        boolean claimed = auditRunDao.claimRun(runId, token, Instant.now());

        if (claimed) {
            logger.info("Run successfully claimed: runId={}", runId);
            return Optional.of(token);
        }

        logger.debug("Run already claimed or not in QUEUED state: runId={}", runId);
        return Optional.empty();
    }

    public void complete(long runId, String resultJson) {
        logger.info("Marking run as COMPLETED: runId={}", runId);
        auditRunDao.markCompleted(runId, Instant.now(), resultJson);
    }

    public void fail(long runId, String errorMessage) {
        logger.warn(
            "Marking run as FAILED: runId={}, error={}",
            runId,
            errorMessage
        );
        auditRunDao.markFailed(runId, Instant.now(), errorMessage);
    }
}
