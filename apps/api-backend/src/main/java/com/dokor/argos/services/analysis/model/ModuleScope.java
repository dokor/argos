package com.dokor.argos.services.analysis.model;

/**
 * Portée d'un module d'analyse.
 * <p>
 * Détermine si le résultat d'un module est propre à une page URL ({@link #PAGE})
 * ou partageable entre toutes les pages d'un même domaine ({@link #DOMAIN}).
 * <p>
 * Les modules DOMAIN bénéficient d'un mécanisme de cache :
 * si un résultat frais existe pour le domaine, il est réutilisé sans ré-exécution.
 */
public enum ModuleScope {

    /**
     * Résultat spécifique à une URL.
     * Exemples : HTTP headers, HTML content, Lighthouse score, Runtime JS.
     */
    PAGE,

    /**
     * Résultat partagé pour l'ensemble du domaine (hostname).
     * Exemples : détection de la stack technique (CMS, framework, CDN).
     */
    DOMAIN
}
