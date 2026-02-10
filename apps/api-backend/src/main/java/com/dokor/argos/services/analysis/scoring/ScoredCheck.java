package com.dokor.argos.services.analysis.scoring;

import com.dokor.argos.services.analysis.model.enums.AuditStatus;

import java.util.List;

/**
 * Trace "audit -> score" check par check (utile PDF + debug).
 */
public record ScoredCheck(
    String key,
    String moduleId,
    AuditStatus status,
    boolean scorable,
    double weight,
    double score,
    List<String> tags
) {}
