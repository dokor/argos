package com.dokor.argos.services.analysis.scoring;

import java.util.List;
import java.util.Optional;

/**
 * Définit comment scorer un check (poids + tags + scorable).
 * Centralise les décisions : les analyzers ne portent pas la logique de scoring.
 */
public interface ScorePolicy {

    int version();

    ScoreRule ruleFor(String moduleId, String checkKey);

    /**
     * Domaine métier affichable auquel rattacher le check. Les tags techniques
     * (module et outil) restent de la provenance et ne doivent pas créer de
     * catégorie dans le rapport public.
     */
    default Optional<String> businessCategoryFor(String moduleId, String checkKey, List<String> sourceTags) {
        return ruleFor(moduleId, checkKey).tags().stream()
            .filter(tag -> List.of("performance", "security", "seo", "a11y").contains(tag))
            .findFirst();
    }

    record ScoreRule(
        boolean scorable,
        double weight,
        List<String> tags
    ) {}
}
