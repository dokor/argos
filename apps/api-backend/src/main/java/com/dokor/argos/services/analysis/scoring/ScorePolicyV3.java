package com.dokor.argos.services.analysis.scoring;

import jakarta.inject.Singleton;

/**
 * Politique de scoring v3 — fiabilisation des seuils de statut des analyzers (issue #100).
 * <p>
 * Le <b>barème (poids + tags par clé)</b> est strictement identique à {@link ScorePolicyV2} :
 * cette version ne change aucune règle de poids et hérite donc de tout {@link #ruleFor}.
 * Le bump de version matérialise le fait que la <b>sémantique du score change</b> à barème
 * constant, pour que les rapports produits avant/après restent comparables via leur
 * {@code scoringVersion} :
 * <ul>
 *   <li><b>Lighthouse</b> : le score utilise désormais un ratio continu (score/100) au lieu
 *       des seuils durs PASS/WARN/FAIL — plus d'effet de falaise aux bornes (59 vs 60).</li>
 *   <li><b>HTTP response time</b> et <b>cache HTML</b> : passés en INFO (non scorés) — ils
 *       produisaient des faux positifs (latence non déterministe du worker, absence de cache
 *       souvent correcte sur du HTML dynamique).</li>
 *   <li><b>SSL</b> : grade/validité/expiration <b>indisponibles</b> passés en INFO (non scorés)
 *       au lieu de WARN — on ne confond plus "inconnu" avec "médiocre".</li>
 *   <li><b>runtime.console.errors</b> : seuil de bascule FAIL relevé (scripts tiers).</li>
 * </ul>
 * Ces changements sont portés par les analyzers et {@code ScoreService} (ratio continu) ;
 * aucune règle de poids n'est modifiée ici.
 */
@Singleton
public class ScorePolicyV3 extends ScorePolicyV2 {

    private static final int VERSION = 3;

    @Override
    public int version() {
        return VERSION;
    }
}
