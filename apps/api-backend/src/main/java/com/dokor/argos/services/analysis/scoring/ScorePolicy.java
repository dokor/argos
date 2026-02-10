package com.dokor.argos.services.analysis.scoring;

import java.util.List;

/**
 * Définit comment scorer un check (poids + tags + scorable).
 * Centralise les décisions : les analyzers ne portent pas la logique de scoring.
 */
public interface ScorePolicy {

    int version();

    ScoreRule ruleFor(String moduleId, String checkKey);

    record ScoreRule(
        boolean scorable,
        double weight,
        List<String> tags
    ) {}
}
