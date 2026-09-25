package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Calcule le score global d'un audit à partir des résultats enrichis des modules.
 * <p>
 * Pour chaque check scorable ({@link AuditCheckResult#scorable()} = true), le score
 * est calculé comme {@code weight × ratio} où le ratio vaut :
 * <ul>
 *   <li>{@link AuditCheckResult#scoreRatio()} (borné à [0,1]) s'il est renseigné -
 *       ratio continu pour les checks à note graduée (ex. Lighthouse), évitant les
 *       effets de falaise aux bornes de seuils ;</li>
 *   <li>sinon le ratio dérivé du status : 1.0 pour PASS, 0.5 pour WARN, 0.0 pour
 *       FAIL, 0.0 pour INFO.</li>
 * </ul>
 * <p>
 * Les checks doivent avoir été préalablement enrichis par {@link ScoreEnricherService}.
 * Chaque domaine métier est d'abord normalisé sur ses propres checks, puis le global est
 * la somme des quatre domaines configurés à poids égal (25 % chacun). Lorsqu'un domaine
 * n'est pas mesurable, son poids est redistribué entre les domaines mesurables. Sans
 * aucun domaine mesurable, le global est {@code 0/0}, donc indisponible plutôt qu'en échec.
 * Les résultats sont aussi agrégés par module et par tag pour une vue granulaire.
 *
 * @see AuditScoreReport
 * @see ScoreEnricherService
 */
@Singleton
public class ScoreService {

    private static final Logger logger = LoggerFactory.getLogger(ScoreService.class);
    /** Décision produit #249 : quatre domaines égaux, puis renormalisation des mesurables. */
    private static final Map<ScoreDomain, Double> CONFIGURED_DOMAIN_WEIGHTS = Map.of(
        ScoreDomain.PERFORMANCE, 0.25,
        ScoreDomain.SECURITY, 0.25,
        ScoreDomain.SEO, 0.25,
        ScoreDomain.A11Y, 0.25
    );

    public AuditScoreReport compute(int scoringVersion, List<AuditModuleResult> modules) {
        logger.info("Computing score scoringVersion={} modules={}", scoringVersion, modules.size());

        List<ScoredCheck> scoredChecks = new ArrayList<>();
        Map<String, double[]> byModule = new LinkedHashMap<>(); // id -> [score, max]
        Map<String, double[]> byTag = new LinkedHashMap<>();    // tag -> [score, max]
        Map<ScoreDomain, double[]> byDomain = new EnumMap<>(ScoreDomain.class);
        for (ScoreDomain domain : ScoreDomain.values()) {
            byDomain.put(domain, new double[]{0.0, 0.0});
        }

        for (AuditModuleResult module : modules) {
            String moduleId = module.id();
            byModule.putIfAbsent(moduleId, new double[]{0.0, 0.0});

            for (AuditCheckResult check : module.checks()) {
                double ratio = effectiveRatio(check);

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

                businessDomain(check.tags()).ifPresent(domain -> {
                    double[] aggregate = byDomain.get(domain);
                    aggregate[0] += score;
                    aggregate[1] += weight;
                });
            }
        }

        List<ScoreAggregate> domainAgg = Arrays.stream(ScoreDomain.values())
            .map(domain -> ScoreAggregate.of(domain.id(), byDomain.get(domain)[0], byDomain.get(domain)[1]))
            .toList();
        Map<String, Double> effectiveDomainWeights = effectiveDomainWeights(byDomain);
        double globalRatio = domainAgg.stream()
            .mapToDouble(domain -> domain.ratio() * effectiveDomainWeights.getOrDefault(domain.id(), 0.0))
            .sum();
        boolean hasMeasurableDomain = effectiveDomainWeights.values().stream().anyMatch(weight -> weight > 0.0);
        // Le global est exprimé sur 100, indépendamment du nombre de checks disponibles.
        // Sans domaine mesurable, 0/0 signale explicitement une note indisponible.
        ScoreAggregate global = hasMeasurableDomain
            ? ScoreAggregate.of("global", globalRatio * 100.0, 100.0)
            : ScoreAggregate.of("global", 0.0, 0.0);

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
            domainAgg,
            effectiveDomainWeights,
            scoredChecks
        );
    }

    /**
     * Ratio de score effectif d'un check : ratio continu {@link AuditCheckResult#scoreRatio()}
     * borné à [0,1] s'il est renseigné, sinon ratio dérivé du status.
     */
    private static double effectiveRatio(AuditCheckResult check) {
        Double continuous = check.scoreRatio();
        if (continuous != null) {
            return Math.max(0.0, Math.min(1.0, continuous));
        }
        return ratioFor(check.status());
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

    private static Optional<ScoreDomain> businessDomain(List<String> tags) {
        Set<String> normalizedTags = new HashSet<>(safeTags(tags));
        return Arrays.stream(ScoreDomain.values())
            .filter(domain -> normalizedTags.contains(domain.id()))
            .findFirst();
    }

    private static Map<String, Double> effectiveDomainWeights(Map<ScoreDomain, double[]> byDomain) {
        double measurableWeight = CONFIGURED_DOMAIN_WEIGHTS.entrySet().stream()
            .filter(entry -> byDomain.get(entry.getKey())[1] > 0.0)
            .mapToDouble(Map.Entry::getValue)
            .sum();

        Map<String, Double> result = new LinkedHashMap<>();
        for (ScoreDomain domain : ScoreDomain.values()) {
            boolean measurable = byDomain.get(domain)[1] > 0.0;
            double configuredWeight = CONFIGURED_DOMAIN_WEIGHTS.get(domain);
            result.put(domain.id(), measurableWeight > 0.0 && measurable
                ? configuredWeight / measurableWeight
                : 0.0);
        }
        return Collections.unmodifiableMap(result);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
