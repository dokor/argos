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
     * Portée du module : PAGE (par défaut) ou DOMAIN.
     * <p>
     * Les modules DOMAIN sont exécutés une seule fois par domaine et leur résultat
     * est mis en cache. Les modules PAGE sont exécutés à chaque analyse d'URL.
     *
     * @return portée du module
     */
    default ModuleScope scope() {
        return ModuleScope.PAGE;
    }

    /**
     * Analyse l'URL et retourne le résultat du module.
     *
     * @param context contexte partagé entre modules (URL, headers HTTP, body HTML, domainId…)
     * @param logger  logger fourni par l'orchestrateur (pour identifier facilement le run)
     */
    AuditModuleResult analyze(AuditContext context, Logger logger);
}
