package com.dokor.argos.services.analysis.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Contexte partagé entre les modules d'analyse.
 *
 * Objectif :
 * - éviter de passer 10 paramètres à chaque analyzer
 * - garantir un contrat stable (finalUrl, headers, body, redirect chain, etc.)
 * - simplifier l'orchestrateur et les analyzers
 *
 * Le contexte est IMMUTABLE (record) : chaque étape peut produire une nouvelle version enrichie
 * (via withXxx(...) ci-dessous).
 */
public record AuditContext(
    String inputUrl,
    String normalizedUrl,
    long domainId,
    Instant startedAt,

    // Résultat "HTTP-level" (rempli après HttpModuleAnalyzer)
    String finalUrl,
    int httpStatusCode,
    long httpDurationMs,
    List<String> redirectChain,
    Map<String, String> headers,
    String body,
    List<String> navigationOrigins
) {
    public AuditContext { navigationOrigins = navigationOrigins == null || navigationOrigins.isEmpty()
        ? List.of() : com.dokor.argos.services.ci.CiOrigin.scope(navigationOrigins); }
    public AuditContext(String inputUrl,String normalizedUrl,long domainId,Instant startedAt,
        String finalUrl,int status,long duration,List<String> redirects,Map<String,String> headers,String body) {
        this(inputUrl,normalizedUrl,domainId,startedAt,finalUrl,status,duration,redirects,headers,body,List.of());
    }
    public AuditContext withNavigationOrigins(List<String> origins) {
        return new AuditContext(inputUrl,normalizedUrl,domainId,startedAt,finalUrl,httpStatusCode,httpDurationMs,
            redirectChain,headers,body,com.dokor.argos.services.ci.CiOrigin.scope(origins));
    }
    /**
     * Constructeur initial : crée le contexte avant toute analyse.
     *
     * @param inputUrl      URL brute soumise par l'utilisateur
     * @param normalizedUrl URL normalisée (clé fonctionnelle)
     * @param domainId      identifiant du domaine en base (ARG_DOMAIN.id)
     */
    public AuditContext(String inputUrl, String normalizedUrl, long domainId) {
        this(
            inputUrl,
            normalizedUrl,
            domainId,
            Instant.now(),
            null,
            0,
            0L,
            List.of(),
            Map.of(),
            null
        );
    }

    public AuditContext withHttpResult(
        String finalUrl,
        int httpStatusCode,
        long httpDurationMs,
        List<String> redirectChain,
        Map<String, String> headers,
        String body
    ) {
        return new AuditContext(
            inputUrl,
            normalizedUrl,
            domainId,
            startedAt,
            finalUrl,
            httpStatusCode,
            httpDurationMs,
            redirectChain != null ? redirectChain : List.of(),
            headers != null ? headers : Map.of(),
            body,
            navigationOrigins
        );
    }
}
