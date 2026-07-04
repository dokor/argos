package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;

import java.util.List;

/**
 * Politique de scoring v5 — audits Lighthouse individuels (issue #154).
 * <p>
 * Hérite du barème de {@link ScorePolicyV4}. Rend les checks
 * {@code lighthouse.audit.*} <b>scorables mais de poids nul</b> : ils remontent
 * ainsi comme issues actionnables dans le rapport (les checks non scorables sont
 * filtrés par {@code PublicReportComposer#buildIssues}) <b>sans</b> peser une
 * seconde fois dans le score. Les quatre notes de catégorie
 * ({@code lighthouse.score.*}) portent déjà le poids agrégé de Lighthouse : faire
 * compter en plus chaque audit reviendrait à un double comptage.
 */
@Singleton
public class ScorePolicyV5 extends ScorePolicyV4 {

    private static final int VERSION = 5;

    @Override
    public int version() {
        return VERSION;
    }

    @Override
    public ScoreRule ruleFor(String moduleId, String checkKey) {
        if (checkKey != null && checkKey.startsWith("lighthouse.audit.")) {
            // scorable => surfacé comme issue ; weight 0 => n'entre pas dans le score.
            return new ScoreRule(true, 0, List.of("lighthouse"));
        }
        return super.ruleFor(moduleId, checkKey);
    }
}
