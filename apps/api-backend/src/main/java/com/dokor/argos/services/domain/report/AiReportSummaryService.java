package com.dokor.argos.services.domain.report;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

@Singleton
public class AiReportSummaryService {

    private final CodexSummaryClient codexSummaryClient;

    @Inject
    public AiReportSummaryService(CodexSummaryClient codexSummaryClient) {
        this.codexSummaryClient = codexSummaryClient;
    }

    public ReportDto enrich(ReportDto report) {
        return codexSummaryClient.summarize(report)
            .map(ai -> new ReportDto(
                report.generatedAt(),
                report.domain(),
                report.url(),
                report.site(),
                report.scores(),
                new ReportDto.Summary(
                    report.summary().oneLiner(),
                    report.summary().priorities(),
                    ai
                ),
                report.issues(),
                report.tech(),
                report.antiBot()
            ))
            .orElse(report);
    }
}
