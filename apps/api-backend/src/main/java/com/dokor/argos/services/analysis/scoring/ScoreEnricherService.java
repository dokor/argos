package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.stream.Collectors;

@Singleton
public class ScoreEnricherService {

    private static final Logger logger = LoggerFactory.getLogger(ScoreEnricherService.class);

    private final ScorePolicy scorePolicy;

    @Inject
    public ScoreEnricherService(ScorePolicy scorePolicy) {
        this.scorePolicy = scorePolicy;
    }

    public int scoringVersion() {
        return scorePolicy.version();
    }

    /**
     * Enrichit tous les checks de tous les modules.
     */
    public List<AuditModuleResult> enrich(List<AuditModuleResult> modules) {
        logger.info("Enriching checks with scoring metadata modules={}", modules.size());

        return modules.stream()
            .map(this::enrichModule)
            .toList();
    }

    private AuditModuleResult enrichModule(AuditModuleResult module) {
        String moduleId = module.id();

        List<AuditCheckResult> enriched = module.checks().stream()
            .map(check -> enrichCheck(moduleId, check))
            .toList();

        return new AuditModuleResult(
            module.id(),
            module.title(),
            module.summary(),
            module.data(),
            enriched
        );
    }

    private AuditCheckResult enrichCheck(String moduleId, AuditCheckResult check) {
        // INFO => non scoré
        if (check.status() == AuditStatus.INFO) {
            return withScore(check, false, 0.0, mergeTags(check.tags(), List.of(moduleId)));
        }

        ScorePolicy.ScoreRule rule = scorePolicy.ruleFor(moduleId, check.key());
        List<String> tags = mergeTags(check.tags(), rule.tags(), List.of(moduleId));

        // si la policy dit non scoré => poids 0
        boolean scorable = rule.scorable();
        double weight = scorable ? rule.weight() : 0.0;

        return withScore(check, scorable, weight, tags);
    }

    private static AuditCheckResult withScore(AuditCheckResult base, boolean scorable, double weight, List<String> tags) {
        return new AuditCheckResult(
            base.key(),
            base.title(),
            base.status(),
            base.severity(),
            scorable,
            weight,
            tags,
            base.value(),
            base.details(),
            base.message(),
            base.recommendation()
        );
    }

    private static List<String> mergeTags(List<String>... lists) {
        return Arrays.stream(lists)
            .filter(Objects::nonNull)
            .flatMap(Collection::stream)
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new))
            .stream()
            .toList();
    }
}
