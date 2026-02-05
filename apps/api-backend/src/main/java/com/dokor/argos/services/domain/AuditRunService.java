package com.dokor.argos.services.domain;

import com.dokor.argos.db.dao.AuditRunDao;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Singleton
public class AuditRunService {

    private final AuditRunDao auditRunDao;

    @Inject
    public AuditRunService(AuditRunDao auditRunDao) {
        this.auditRunDao = auditRunDao;
    }

    /**
     * Claim atomique d’un run.
     * Retourne le claimToken si OK, empty sinon.
     */
    public Optional<String> claim(long runId) {
        String token = UUID.randomUUID().toString().replace("-", "");
        boolean claimed = auditRunDao.claimRun(runId, token, Instant.now());
        return claimed ? Optional.of(token) : Optional.empty();
    }

    public void complete(long runId, String resultJson) {
        auditRunDao.markCompleted(runId, Instant.now(), resultJson);
    }

    public void fail(long runId, String errorMessage) {
        auditRunDao.markFailed(runId, Instant.now(), errorMessage);
    }
}
