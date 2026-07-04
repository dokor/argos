package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;

import java.util.List;

/**
 * Politique de scoring v4 — enrichissement des vérifications (issues #151-158).
 * <p>
 * Hérite du barème de {@link ScorePolicyV3} et ajoute les règles des nouveaux
 * checks scorables introduits par l'enrichissement des modules. Le bump de
 * version matérialise le changement de barème (nouveaux checks au dénominateur).
 * <ul>
 *   <li>{@code tech.security.version_disclosure} (issue #158) — divulgation de
 *       version logicielle via les en-têtes, tag {@code security}, poids 3.</li>
 * </ul>
 */
@Singleton
public class ScorePolicyV4 extends ScorePolicyV3 {

    private static final int VERSION = 4;

    @Override
    public int version() {
        return VERSION;
    }

    @Override
    public ScoreRule ruleFor(String moduleId, String checkKey) {
        if ("tech.security.version_disclosure".equals(checkKey)) {
            return new ScoreRule(true, 3, List.of("security", "tech"));
        }
        return super.ruleFor(moduleId, checkKey);
    }
}
