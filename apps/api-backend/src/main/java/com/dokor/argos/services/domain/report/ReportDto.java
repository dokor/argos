package com.dokor.argos.services.domain.report;

import java.util.List;

public record ReportDto(
    String generatedAt,
    String domain,
    String url,
    Site site,
    Scores scores,
    Summary summary,
    List<Issue> issues
) {
    public record Site(String title, String logoUrl) {}

    public record Scores(
        int global, // 0..100
        List<CategoryScore> byCategory
    ) {}

    public record CategoryScore(
        String key,
        String label,
        int score,
        int issues
    ) {}

    public record Summary(
        String oneLiner,
        List<Priority> priorities
    ) {}

    public record Priority(
        Severity severity, // critical|important|opportunity
        String title,
        String impact,
        Effort effort
    ) {}

    public record Issue(
        String id,
        String categoryKey,
        String module,
        IssueSeverity severity, // critical|important|info
        String title,
        String impact,
        String evidence,
        String recommendation,
        Effort effort
    ) {}

    public enum Severity { critical, important, opportunity }
    public enum IssueSeverity { critical, important, info }
    public enum Effort { XS, S, M, L }
}
