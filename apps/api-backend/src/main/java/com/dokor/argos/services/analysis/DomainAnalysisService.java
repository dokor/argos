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
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.time.Duration;
import java.time.Instant;

/** Caches stack signatures for 24h only when final URL and detection inputs match.
 * Response checks and security recommendations always use the current run.
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

    public AuditModuleResult getOrRunTechAnalysis(AuditContext context, Logger logger) {
        long domainId = context.domainId();
        String fingerprint = fingerprint(context);
        String sourceUrl = context.finalUrl();
        // The domain row exists even when the cache does not. Lock it across the
        // read, repair and local tech analysis so concurrent workers share one run.
        AnalysisOutcome outcome = domainAnalysisDao.withLockedDomain(domainId, connection -> {
            var cached = domainAnalysisDao.findFreshByDomainId(domainId, connection);
            if (cached.isPresent()) {
                try {
                    TechCache entry = deserialize(cached.get());
                    if (sourceUrl != null && sourceUrl.equals(entry.sourceFinalUrl())
                        && fingerprint.equals(entry.signalFingerprint())) {
                        logger.info("Tech stack cache hit domainId={} expiresAt={}", domainId, cached.get().getExpiresAt());
                        return new AnalysisOutcome(withProvenance(entry.stack(), cached.get(), sourceUrl, true), null);
                    }
                } catch (Exception invalidCache) {
                    // Jackson exceptions can contain snippets of cached URLs.
                    DomainAnalysisService.logger.warn("Invalid tech cache domainId={} errorType={} - deleting and recalculating",
                        domainId, invalidCache.getClass().getSimpleName());
                    domainAnalysisDao.deleteByDomainId(domainId, connection);
                }
            }

            logger.info("Tech analysis cache miss domainId={} - running TechModuleAnalyzer", domainId);
            try {
                AuditModuleResult result = techModuleAnalyzer.analyzeStack(context, logger);
                if (result == null || !AuditModule.TECH.id().equals(result.id()) || result.checks() == null) {
                    throw new IllegalStateException("Tech analyzer returned an invalid result");
                }
                DomainAnalysis entity = persist(domainId, new TechCache(1, sourceUrl, fingerprint, result), connection);
                return new AnalysisOutcome(withProvenance(result, entity, sourceUrl, false), null);
            } catch (RuntimeException failure) {
                // Commit the cache deletion before propagating to runModule, which
                // marks this audit degraded. Never cache a failed recalculation.
                return new AnalysisOutcome(null, failure);
            }
        });
        if (outcome.failure() != null) throw outcome.failure();
        return techModuleAnalyzer.analyzeCurrentResponse(context, outcome.result(), logger);
    }

    // -------------------------
    // Helpers privés
    // -------------------------

    private TechCache deserialize(DomainAnalysis entity) throws Exception {
        TechCache entry = objectMapper.readValue(entity.getResultJson(), TechCache.class);
        if (entry == null || entry.schemaVersion() != 1 || entry.stack() == null
            || !AuditModule.TECH.id().equals(entry.stack().id()) || entry.stack().checks() == null
            || entry.stack().checks().stream().anyMatch(c -> !java.util.Set.of(
                "tech.cms", "tech.frontend.framework", "tech.frontend.nextjs").contains(c.key()))
            || entry.stack().data() == null || entity.getAnalyzedAt() == null || entity.getExpiresAt() == null) {
            throw new IllegalStateException("Invalid cached tech stack");
        }
        return entry;
    }

    private String fingerprint(AuditContext context) {
        try {
            // Hash the exact signals used by heuristics. Sorted headers avoid map-order misses.
            byte[] signals = objectMapper.writeValueAsBytes(java.util.Arrays.asList(
                context.body(), new TreeMap<>(context.headers() != null ? context.headers() : Map.of())));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(signals));
        } catch (Exception failure) {
            throw new IllegalStateException("Cannot fingerprint tech signals", failure);
        }
    }

    private AuditModuleResult withProvenance(AuditModuleResult stack, DomainAnalysis entity, String sourceUrl, boolean hit) {
        Map<String, Object> data = new LinkedHashMap<>(stack.data());
        Map<String, Object> provenance = new LinkedHashMap<>();
        provenance.put("hit", hit);
        provenance.put("scope", "FINAL_URL_AND_SIGNALS");
        provenance.put("sourceFinalUrl", sourceUrl);
        provenance.put("analyzedAt", entity.getAnalyzedAt().toString());
        provenance.put("expiresAt", entity.getExpiresAt().toString());
        provenance.put("checkKeys", stack.checks().stream().map(c -> c.key()).toList());
        data.put("stackCache", provenance);
        return new AuditModuleResult(stack.id(), stack.title(), stack.summary(), data, stack.checks());
    }

    private DomainAnalysis persist(long domainId, TechCache result, Connection connection) {
        Instant now = Instant.now();
        DomainAnalysis entity = new DomainAnalysis();
        entity.setAnalyzedAt(now);
        entity.setExpiresAt(now.plus(DOMAIN_ANALYSIS_TTL));
        try {
            entity.setDomainId(domainId);
            entity.setResultJson(objectMapper.writeValueAsString(result));
            domainAnalysisDao.deleteByDomainId(domainId, connection);
            domainAnalysisDao.save(entity, connection);

            DomainAnalysisService.logger.info(
                "Tech analysis persisted domainId={} expiresAt={}", domainId, entity.getExpiresAt()
            );
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            // A valid analysis can still be returned if it cannot be serialized.
            DomainAnalysisService.logger.warn("Failed to serialize tech stack domainId={} errorType={}", domainId, e.getClass().getSimpleName());
        }
        return entity;
    }

    public record TechCache(int schemaVersion, String sourceFinalUrl, String signalFingerprint, AuditModuleResult stack) {}

    private record AnalysisOutcome(AuditModuleResult result, RuntimeException failure) {}
}
