package com.dokor.argos.services.analysis.model;

import com.dokor.argos.services.analysis.model.enums.AuditStatus;

import java.util.List;

public record ScoredCheck(
    String key,
    AuditStatus status,
    boolean scorable,
    double weight,
    double score,
    List<String> tags,
    String moduleId
) {}
