package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;

import java.util.ArrayList;
import java.util.List;

/**
 * Politique de scoring v7 — catégorisation par domaine (issue #197).
 * <p>
 * Décision de conception : les catégories affichées sont désormais les seuls
 * <b>domaines</b> (performance, security, seo, a11y) ; les tags d'outil (lighthouse,
 * ssl, observatory, zap, runtime) ne sont plus des catégories (ils restent une info
 * de provenance). Le filtrage des catégories vit dans {@code PublicReportComposer#isBusinessTag}.
 * <p>
 * Conséquence sur le barème : {@code runtime.*} doit de nouveau porter le domaine
 * {@code performance}. Le bump v6 (#172) l'avait retiré pour éviter le doublon
 * « Runtime » vs « Performance » ; par-domaine il n'existe plus de catégorie
 * « Runtime », donc le runtime doit être rattaché à son domaine (Performance) — sinon
 * ses points seraient orphelins (aucune catégorie). Poids et caractère scorable
 * inchangés ; le score global (compté une seule fois) ne bouge pas.
 */
@Singleton
public class ScorePolicyV7 extends ScorePolicyV6 {

    private static final int VERSION = 7;

    @Override
    public int version() {
        return VERSION;
    }

    @Override
    public ScoreRule ruleFor(String moduleId, String checkKey) {
        ScoreRule rule = super.ruleFor(moduleId, checkKey);
        // Rattache les checks runtime scorables au domaine Performance (annule le
        // retrait fait en v6, désormais inutile puisqu'il n'y a plus de catégorie outil).
        if (checkKey != null && checkKey.startsWith("runtime.")
            && rule.scorable() && !rule.tags().contains("performance")) {
            List<String> tags = new ArrayList<>(rule.tags());
            tags.add("performance");
            return new ScoreRule(rule.scorable(), rule.weight(), List.copyOf(tags));
        }
        return rule;
    }
}
