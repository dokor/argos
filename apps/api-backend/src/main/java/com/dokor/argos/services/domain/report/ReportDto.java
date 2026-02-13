package com.dokor.argos.services.domain.report;

import java.util.List;

public record ReportDto(
    String generatedAt,
    String domain,
    String url,
    SiteDto site,
    ScoresDto scores,
    SummaryDto summary,
    List<IssueDto> issues
) {
    public record SiteDto(String title, String logoUrl) {}
    public record ScoresDto(
        int global,
        List<CategoryScoreDto> byCategory
    ) {}
    public record CategoryScoreDto(String key, String label, int score, int issues) {}

    public record SummaryDto(
        String oneLiner,
        List<PriorityDto> priorities
    ) {}
    public record PriorityDto(
        String severity, // critical|important|opportunity
        String title,
        String impact,
        String effort // XS|S|M|L
    ) {}

    public record IssueDto(
        String id,
        String categoryKey,
        String module,
        String severity, // critical|important|info
        String title,
        String impact,
        String evidence,
        String recommendation,
        String effort
    ) {}
}

