package com.dokor.argos.services.domain.report;

import java.util.List;

public record ReportDto(
    String generatedAt,
    String domain,
    String url,
    Site site,
    Scores scores,
    Summary summary,
    List<Issue> issues,
    Tech tech
) {
    public record Site(String title, String logoUrl) {
    }

    public record Tech(
        Cms cms,
        FrontendFramework frontendFramework,
        NextJs nextJs
    ) {
    }

    public record Cms(
        String name,
        Double confidence
    ) {
    }

    public record FrontendFramework(
        String name,
        Double confidence
    ) {
    }

    public record NextJsVersion(
        String exact,
        String min,
        String max,
        String guess,
        Double guessConfidence,
        String method
    ) {
    }

    public record NextJs(
        Boolean isNext,
        Double confidence,
        String router,       // "app" | "pages" | "unknown"
        String buildId,
        NextJsVersion version,
        List<String> evidence
    ) {
    }

    public record Scores(
        int global, // 0..100
        List<CategoryScore> byCategory
    ) {
    }

    public record CategoryScore(
        String key,
        String label,
        int score,
        int issues
    ) {
    }

    public record Summary(
        String oneLiner,
        List<Priority> priorities
    ) {
    }

    public record Priority(
        Severity severity, // critical|important|opportunity
        String title,
        String impact,
        Effort effort
    ) {
    }

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
    ) {
    }

    public enum Severity {critical, important, opportunity}

    public enum IssueSeverity {critical, important, info}

    public enum Effort {XS, S, M, L}
}
