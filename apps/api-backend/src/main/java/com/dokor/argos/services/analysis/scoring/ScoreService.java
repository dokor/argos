package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@Singleton
public class ScoreService {

    private static final Logger logger = LoggerFactory.getLogger(ScoreService.class);

    public AuditScoreReport compute(int scoringVersion, List<AuditModuleResult> modules) {
        logger.info("Computing score scoringVersion={} modules={}", scoringVersion, modules.size());

        List<ScoredCheck> scoredChecks = new ArrayList<>();
        Map<String, double[]> byModule = new LinkedHashMap<>(); // id -> [score, max]
        Map<String, double[]> byTag = new LinkedHashMap<>();    // tag -> [score, max]

        double globalScore = 0.0;
        double globalMax = 0.0;

        for (AuditModuleResult module : modules) {
            String moduleId = module.id();
            byModule.putIfAbsent(moduleId, new double[]{0.0, 0.0});

            for (AuditCheckResult check : module.checks()) {
                double ratio = ratioFor(check.status());

                double weight = (check.scorable() && check.weight() > 0.0) ? check.weight() : 0.0;
                double score = weight * ratio;

                scoredChecks.add(new ScoredCheck(
                    check.key(),
                    moduleId,
                    check.status(),
                    check.scorable(),
                    weight,
                    score,
                    check.tags() != null ? check.tags() : List.of()
                ));

                if (weight <= 0.0) {
                    continue; // non scoré
                }

                // global
                globalScore += score;
                globalMax += weight;

                // module
                double[] m = byModule.get(moduleId);
                m[0] += score;
                m[1] += weight;

                // tags
                for (String tag : safeTags(check.tags())) {
                    byTag.putIfAbsent(tag, new double[]{0.0, 0.0});
                    double[] t = byTag.get(tag);
                    t[0] += score;
                    t[1] += weight;
                }
            }
        }

        ScoreAggregate global = ScoreAggregate.of("global", globalScore, globalMax);

        List<ScoreAggregate> moduleAgg = byModule.entrySet().stream()
            .map(e -> ScoreAggregate.of(e.getKey(), e.getValue()[0], e.getValue()[1]))
            .toList();

        List<ScoreAggregate> tagAgg = byTag.entrySet().stream()
            .map(e -> ScoreAggregate.of(e.getKey(), e.getValue()[0], e.getValue()[1]))
            .toList();

        logger.info(
            "Score computed globalScore={} globalMax={} ratio={}",
            round2(global.score()),
            round2(global.maxScore()),
            round2(global.ratio())
        );

        return new AuditScoreReport(
            scoringVersion,
            global,
            moduleAgg,
            tagAgg,
            scoredChecks
        );
    }

    private static double ratioFor(AuditStatus status) {
        return switch (status) {
            case PASS -> 1.0;
            case WARN -> 0.5;
            case FAIL -> 0.0;
            case INFO -> 0.0; // INFO ne compte pas (et en pratique weight=0)
        };
    }

    private static List<String> safeTags(List<String> tags) {
        if (tags == null) return List.of();
        return tags.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .toList();
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
