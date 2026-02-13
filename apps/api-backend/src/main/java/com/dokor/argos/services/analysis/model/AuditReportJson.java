package com.dokor.argos.services.analysis.model;

import com.dokor.argos.services.analysis.scoring.AuditScoreReport;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Résultat canonique global d'un audit (c'est ce JSON qu'on stocke dans AuditRun.result_json).
 *
 * Objectifs :
 * - exploitable facilement pour générer un PDF (sections/modules + checks)
 * - exploitable facilement pour calculer un score (pondération par clé de check)
 * - versionnable (schemaVersion)
 */
public record AuditReportJson(
    int schemaVersion,
    String inputUrl,
    String normalizedUrl,
    Instant generatedAt,
    Map<String, String> meta,       // infos transverses (ex: userAgent, analyzerVersion, etc.)
    List<AuditModuleResult> modules, // modules d'analyse (http/html/tech/...)
    AuditScoreReport score
) {}
