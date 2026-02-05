package com.dokor.argos.services.domain;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.domain.enums.AuditRunStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

@Singleton
public class AuditService {
    private static final Logger logger = LoggerFactory.getLogger(AuditService.class);

    private final AuditDao auditDao;
    private final AuditRunDao auditRunDao;
    private final UrlNormalizer urlNormalizer;

    @Inject
    public AuditService(AuditDao auditDao, AuditRunDao auditRunDao, UrlNormalizer urlNormalizer) {
        this.auditDao = auditDao;
        this.auditRunDao = auditRunDao;
        this.urlNormalizer = urlNormalizer;
    }

    /**
     * Point d’entrée métier typique quand un utilisateur soumet une URL :
     * - normalise l’URL
     * - récupère ou crée l’Audit (idempotent)
     * - crée un AuditRun en QUEUED
     */
    public AuditRun createRunForUrl(String inputUrl) {
        String normalizedUrl = urlNormalizer.normalize(inputUrl);
        String hostname = urlNormalizer.extractHostname(normalizedUrl);
        Instant now = Instant.now();

        Audit audit = auditDao.findByNormalizedUrl(normalizedUrl)
            .orElseGet(() -> insertAudit(inputUrl, normalizedUrl, hostname, now));

        return insertRun(audit.getId(), now);
    }

    private Audit insertAudit(String inputUrl, String normalizedUrl, String hostname, Instant now) {
        Audit audit = new Audit();
        audit.setInputUrl(inputUrl);
        audit.setNormalizedUrl(normalizedUrl);
        audit.setHostname(hostname);
        audit.setCreatedAt(now);

        return auditDao.save(audit);
    }

    private AuditRun insertRun(long auditId, Instant now) {
        AuditRun run = new AuditRun();
        run.setAuditId(auditId);
        run.setStatus(AuditRunStatus.QUEUED.name());
        run.setCreatedAt(now);

        return auditRunDao.save(run);
    }
}
