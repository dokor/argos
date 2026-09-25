package com.dokor.argos.services.analysis.scoring;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Définit comment scorer un check (poids, applicabilité, domaine métier et provenance).
 * Centralise les décisions : les analyzers ne portent pas la logique de scoring.
 */
public interface ScorePolicy {

    int version();

    /** Empreinte déterministe du catalogue appliqué, persistée avec le rapport. */
    String fingerprint();

    ScoreRule ruleFor(String moduleId, String checkKey);

    /** Clés exactes du catalogue : utile aux tests de contrat des analyseurs. */
    Set<String> cataloguedKeys();

    /**
     * Domaine métier affichable auquel rattacher le check. Les tags techniques
     * (module et outil) restent de la provenance et ne doivent pas créer de
     * catégorie dans le rapport public.
     */
    default Optional<String> businessCategoryFor(String moduleId, String checkKey, List<String> sourceTags) {
        ScoreRule rule = ruleFor(moduleId, checkKey);
        if (rule.businessCategory() != BusinessCategory.NONE) {
            return Optional.of(rule.businessCategory().tag());
        }
        return Optional.empty();
    }

    record ScoreRule(
        ScoreApplicability applicability,
        double weight,
        BusinessCategory businessCategory,
        TechnicalSource technicalSource
    ) {
        public ScoreRule {
            if (!Double.isFinite(weight) || weight < 0.0) {
                throw new IllegalArgumentException("Score rule weight must be finite and non-negative");
            }
            applicability = applicability != null ? applicability : ScoreApplicability.INFORMATIONAL;
            businessCategory = businessCategory != null ? businessCategory : BusinessCategory.NONE;
            technicalSource = technicalSource != null ? technicalSource : TechnicalSource.MISC;
            if (applicability.contributesToScore() && weight <= 0.0) {
                throw new IllegalArgumentException("A score-applicable rule must have a positive weight");
            }
            if (!applicability.contributesToScore() && weight != 0.0) {
                throw new IllegalArgumentException("A non-scoring rule must have zero weight");
            }
        }

        public boolean scorable() {
            return applicability.isVisibleIssue();
        }

        public List<String> tags() {
            return businessCategory == BusinessCategory.NONE
                ? List.of(technicalSource.tag())
                : List.of(businessCategory.tag(), technicalSource.tag());
        }
    }
}
