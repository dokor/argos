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
    Instant startedAt,

    // Résultat "HTTP-level" (rempli après HttpModuleAnalyzer)
    String finalUrl,
    int httpStatusCode,
    long httpDurationMs,
    List<String> redirectChain,
    Map<String, String> headers,
    String body
) {
    public AuditContext(String inputUrl, String normalizedUrl) {
        this(
            inputUrl,
            normalizedUrl,
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
            startedAt,
            finalUrl,
            httpStatusCode,
            httpDurationMs,
            redirectChain != null ? redirectChain : List.of(),
            headers != null ? headers : Map.of(),
            body
        );
    }
}
