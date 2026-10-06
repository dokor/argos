package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditDao;
import com.dokor.argos.db.generated.Audit;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.db.generated.Domain;
import com.dokor.argos.services.domain.domain.DomainService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

/** Creates audits and queued runs. Queries and queue processing live in separate services. */
@Singleton
public class AuditService {
    private static final Logger logger = LoggerFactory.getLogger(AuditService.class);
    private final AuditDao auditDao;
    private final AuditRunService auditRunService;
    private final UrlNormalizer urlNormalizer;
    private final DomainService domainService;

    @Inject
    public AuditService(AuditDao auditDao, AuditRunService auditRunService,
                        UrlNormalizer urlNormalizer, DomainService domainService) {
        this.auditDao = auditDao;
        this.auditRunService = auditRunService;
        this.urlNormalizer = urlNormalizer;
        this.domainService = domainService;
    }

    public record CreatedAudit(long runId, long auditId, String status, Instant createdAt, String reportToken) {}

    /** Normalizes the URL, reuses its audit and creates an independent queued run. */
    public CreatedAudit createAudit(String inputUrl) {
        logger.info("AuditService.createAudit inputUrl={}", UrlNormalizer.sanitizeForLog(inputUrl));
        String normalizedUrl = urlNormalizer.normalize(inputUrl);
        String hostname = urlNormalizer.extractHostname(normalizedUrl);
        Instant now = Instant.now();

        Domain domain = domainService.findOrCreate(hostname);
        Audit candidate = new Audit();
        candidate.setDomainId(domain.getId());
        candidate.setInputUrl(inputUrl);
        candidate.setNormalizedUrl(normalizedUrl);
        candidate.setCreatedAt(now);
        Audit audit = auditDao.findOrCreate(candidate);

        var created = auditRunService.createQueuedRun(audit.getId(), now);
        AuditRun run = created.run();
        logger.info("Run created: auditId={}, runId={}, status={}", audit.getId(), run.getId(), run.getStatus());
        return new CreatedAudit(run.getId(), run.getAuditId(), run.getStatus(),
            run.getCreatedAt(), created.reportToken());
    }
}
