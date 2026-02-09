package com.dokor.argos.services.analysis.model;

import java.util.List;
import java.util.Map;

/**
 * Résultat d'un module d'analyse (ex: "http", "html").
 * <p>
 * - id : stable, sert à grouper l'affichage dans le PDF
 * - summary : résumé humain (optionnel) utile pour UI/PDF
 * - data : data "brute" du module (optionnel) si tu veux stocker une vue plus complète
 * - checks : liste standardisée d'indicateurs, utilisée pour le scoring et le rendu
 */
public record AuditModuleResult(
    String id,
    String title,
    String summary,
    Map<String, Object> data,
    List<AuditCheckResult> checks
) {
}
