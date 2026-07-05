package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;

import java.util.ArrayList;
import java.util.List;

/**
 * Politique de scoring v6 — le runtime relève de sa propre catégorie (issue #172).
 * <p>
 * Hérite du barème de {@link ScorePolicyV5} et <b>retire le tag {@code performance}</b>
 * des checks {@code runtime.*}. Auparavant ces checks étaient taggés à la fois
 * {@code performance} et {@code runtime} (barème V2), ce qui faisait apparaître une
 * même issue runtime dans les deux catégories « Runtime » et « Performance » — doublon
 * visible et double réduction du score <i>par catégorie</i>.
 * <p>
 * Le poids et le caractère scorable sont inchangés : le score <b>global</b> (compté une
 * seule fois par check) ne bouge pas ; seule la répartition par catégorie est corrigée.
 * La catégorie « Performance » reste alimentée par Lighthouse
 * ({@code lighthouse.score.performance}). Conforme à AGENTS.md : « Module {@code runtime.*}
 * → tag {@code runtime} uniquement ».
 */
@Singleton
public class ScorePolicyV6 extends ScorePolicyV5 {

    private static final int VERSION = 6;

    @Override
    public int version() {
        return VERSION;
    }

    @Override
    public ScoreRule ruleFor(String moduleId, String checkKey) {
        ScoreRule rule = super.ruleFor(moduleId, checkKey);
        if (checkKey != null && checkKey.startsWith("runtime.") && rule.tags().contains("performance")) {
            List<String> tags = new ArrayList<>(rule.tags());
            tags.remove("performance");
            if (!tags.contains("runtime")) {
                tags.add("runtime");
            }
            return new ScoreRule(rule.scorable(), rule.weight(), List.copyOf(tags));
        }
        return rule;
    }
}
