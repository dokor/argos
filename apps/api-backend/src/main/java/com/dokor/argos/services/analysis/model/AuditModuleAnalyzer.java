package com.dokor.argos.services.analysis.model;

import org.slf4j.Logger;

/**
 * Un "module analyzer" est un plugin d'analyse.
 *
 * - Exemple de modules : http, html, tech, perf...
 * - Chaque module produit un AuditModuleResult structuré, composé de checks (AuditCheckResult).
 *
 * Principe :
 * - L'orchestrateur (AuditProcessorService) appelle plusieurs analyzers.
 * - Il agrège leurs résultats dans un AuditReport global.
 *
 * Important :
 * - L'analyzer NE gère pas la persistance (ça reste dans AuditProcessorService / AuditRunService).
 * - L'analyzer NE dépend pas du webservice (hexagonal).
 */
public interface AuditModuleAnalyzer {

    /**
     * Identifiant stable du module (ex: "http", "html", "tech").
     * Sert à grouper l'affichage PDF et l'organisation des résultats.
     */
    String moduleId();

    /**
     * Analyse l'URL et retourne le résultat du module.
     *
     * @param inputUrl URL d'entrée (telle que demandée)
     * @param normalizedUrl URL normalisée (celle utilisée côté domaine)
     * @param logger logger fourni par l'orchestrateur (permet d'identifier facilement le run)
     */
    AuditModuleResult analyze(String inputUrl, String normalizedUrl, Logger logger);
}
