package com.dokor.argos.services.analysis;

import com.dokor.argos.db.dao.DomainAnalysisDao;
import com.dokor.argos.db.generated.DomainAnalysis;
import com.dokor.argos.services.analysis.model.AuditContext;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.modules.tech.TechModuleAnalyzer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.time.Duration;
import java.time.Instant;

/**
 * Orchestre l'analyse de niveau domaine (module "tech") avec mise en cache TTL.
 * <p>
 * Logique :
 * <ol>
 *   <li>Si une analyse récente (non expirée) existe pour le domaine → on la réutilise.</li>
 *   <li>Sinon → on exécute {@link TechModuleAnalyzer}, on supprime l'ancienne entrée
 *       et on persiste le nouveau résultat.</li>
 * </ol>
 * Le TTL par défaut est de 24 heures : la stack technique d'un site ne change pas
 * à chaque analyse de page.
 */
@Singleton
public class DomainAnalysisService {

    private static final Logger logger = LoggerFactory.getLogger(DomainAnalysisService.class);

    /** Durée de validité d'une analyse de domaine. */
    private static final Duration DOMAIN_ANALYSIS_TTL = Duration.ofHours(24);

    private final DomainAnalysisDao domainAnalysisDao;
    private final TechModuleAnalyzer techModuleAnalyzer;
    private final ObjectMapper objectMapper;

    @Inject
    public DomainAnalysisService(
        DomainAnalysisDao domainAnalysisDao,
        TechModuleAnalyzer techModuleAnalyzer,
        ObjectMapper objectMapper
    ) {
        this.domainAnalysisDao = domainAnalysisDao;
        this.techModuleAnalyzer = techModuleAnalyzer;
        this.objectMapper = objectMapper;
    }

    /**
     * Retourne le résultat du module "tech" pour le domaine du contexte.
     * <p>
     * Si une entrée non expirée existe en base, elle est désérialisée et retournée
     * sans ré-exécuter l'analyse. Sinon, {@link TechModuleAnalyzer#analyze} est appelé,
     * le résultat est persisté et retourné.
     *
     * @param context contexte d'audit courant (contient le domainId)
     * @param logger  logger de l'orchestrateur (pour tracer le run en cours)
     * @return résultat du module tech (frais ou depuis le cache)
     */
    public AuditModuleResult getOrRunTechAnalysis(AuditContext context, Logger logger) {
        long domainId = context.domainId();
        // The domain row exists even when the cache does not. Lock it across the
        // read, repair and local tech analysis so concurrent workers share one run.
        AnalysisOutcome outcome = domainAnalysisDao.withLockedDomain(domainId, connection -> {
            var cached = domainAnalysisDao.findFreshByDomainId(domainId, connection);
            if (cached.isPresent()) {
                try {
                    AuditModuleResult result = deserialize(cached.get());
                    logger.info("Tech analysis cache hit domainId={} expiresAt={}", domainId, cached.get().getExpiresAt());
                    return new AnalysisOutcome(result, null);
                } catch (Exception invalidCache) {
                    // Jackson exceptions can contain snippets of cached URLs.
                    DomainAnalysisService.logger.warn("Invalid tech cache domainId={} errorType={} - deleting and recalculating",
                        domainId, invalidCache.getClass().getSimpleName());
                    domainAnalysisDao.deleteByDomainId(domainId, connection);
                }
            }

            logger.info("Tech analysis cache miss domainId={} - running TechModuleAnalyzer", domainId);
            try {
                AuditModuleResult result = techModuleAnalyzer.analyze(context, logger);
                if (result == null || !AuditModule.TECH.id().equals(result.id()) || result.checks() == null) {
                    throw new IllegalStateException("Tech analyzer returned an invalid result");
                }
                persist(domainId, result, connection);
                return new AnalysisOutcome(result, null);
            } catch (RuntimeException failure) {
                // Commit the cache deletion before propagating to runModule, which
                // marks this audit degraded. Never cache a failed recalculation.
                return new AnalysisOutcome(null, failure);
            }
        });
        if (outcome.failure() != null) throw outcome.failure();
        return outcome.result();
    }

    // -------------------------
    // Helpers privés
    // -------------------------

    private AuditModuleResult deserialize(DomainAnalysis entity) throws Exception {
        AuditModuleResult result = objectMapper.readValue(entity.getResultJson(), AuditModuleResult.class);
        if (result == null || !AuditModule.TECH.id().equals(result.id()) || result.checks() == null) {
            throw new IllegalStateException("Invalid cached tech result");
        }
        return result;
    }

    private void persist(long domainId, AuditModuleResult result, Connection connection) {
        try {
            Instant now = Instant.now();
            DomainAnalysis entity = new DomainAnalysis();
            entity.setDomainId(domainId);
            entity.setResultJson(objectMapper.writeValueAsString(result));
            entity.setAnalyzedAt(now);
            entity.setExpiresAt(now.plus(DOMAIN_ANALYSIS_TTL));
            domainAnalysisDao.deleteByDomainId(domainId, connection);
            domainAnalysisDao.save(entity, connection);

            DomainAnalysisService.logger.info(
                "Tech analysis persisted domainId={} expiresAt={}", domainId, entity.getExpiresAt()
            );
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            // A valid analysis can still be returned if it cannot be serialized.
            DomainAnalysisService.logger.warn("Failed to serialize tech analysis domainId={}", domainId, e);
        }
    }

    private record AnalysisOutcome(AuditModuleResult result, RuntimeException failure) {}
}
