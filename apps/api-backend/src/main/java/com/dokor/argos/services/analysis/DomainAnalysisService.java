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

        // 1. Chercher un résultat valide en cache
        var cached = domainAnalysisDao.findFreshByDomainId(domainId);
        if (cached.isPresent()) {
            logger.info("Tech analysis cache hit domainId={} expiresAt={}", domainId, cached.get().getExpiresAt());
            return deserialize(cached.get());
        }

        // 2. Pas de cache valide → exécuter le module
        logger.info("Tech analysis cache miss domainId={} — running TechModuleAnalyzer", domainId);
        AuditModuleResult result = techModuleAnalyzer.analyze(context, logger);

        // 3. Persister (remplace l'ancienne entrée si présente)
        persist(domainId, result);

        return result;
    }

    // -------------------------
    // Helpers privés
    // -------------------------

    private AuditModuleResult deserialize(DomainAnalysis entity) {
        try {
            return objectMapper.readValue(entity.getResultJson(), AuditModuleResult.class);
        } catch (Exception e) {
            // Cache corrompu : on loggue et on laisse l'appelant gérer (il repassera par run)
            DomainAnalysisService.logger.warn(
                "Failed to deserialize cached tech result domainId={} — will re-run",
                entity.getDomainId(), e
            );
            throw new IllegalStateException("Corrupted domain analysis cache for domainId=" + entity.getDomainId(), e);
        }
    }

    private void persist(long domainId, AuditModuleResult result) {
        try {
            // Supprimer l'ancienne entrée (une seule ligne par domaine)
            domainAnalysisDao.deleteByDomainId(domainId);

            Instant now = Instant.now();
            DomainAnalysis entity = new DomainAnalysis();
            entity.setDomainId(domainId);
            entity.setResultJson(objectMapper.writeValueAsString(result));
            entity.setAnalyzedAt(now);
            entity.setExpiresAt(now.plus(DOMAIN_ANALYSIS_TTL));
            domainAnalysisDao.save(entity);

            DomainAnalysisService.logger.info(
                "Tech analysis persisted domainId={} expiresAt={}", domainId, entity.getExpiresAt()
            );
        } catch (Exception e) {
            // Échec de persistance non bloquant : le résultat est quand même retourné
            DomainAnalysisService.logger.warn(
                "Failed to persist domain analysis domainId={}", domainId, e
            );
        }
    }
}
