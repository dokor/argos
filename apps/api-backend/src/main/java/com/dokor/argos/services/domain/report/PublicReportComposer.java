package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.scoring.AuditScoreReport;
import com.dokor.argos.services.analysis.scoring.ScoreAggregate;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Singleton
public class PublicReportComposer {

    private static final Logger logger = LoggerFactory.getLogger(PublicReportComposer.class);

    @SuppressWarnings("unchecked")
    public ReportDto compose(AuditReportJson internalReport) {
        logger.info("Composing public report from schemaVersion={}", internalReport.schemaVersion());

        String url = internalReport.normalizedUrl();
        String domain = extractDomain(url);

        AuditScoreReport score = internalReport.score();
        int global100 = score != null ? toScore100(score.global().ratio()) : 0;

        List<ReportDto.CategoryScore> byCategory = (score == null ? List.<ScoreAggregate>of() : score.byTag()).stream()
            .filter(agg -> isBusinessTag(agg.id()))
            .map(agg -> new ReportDto.CategoryScore(
                agg.id(),
                labelize(agg.id()),
                toScore100(agg.ratio()),
                0
            ))
            .toList();

        List<ReportDto.Issue> issues = buildIssues(internalReport);

        Map<String, Long> issuesByCat = issues.stream()
            .collect(Collectors.groupingBy(ReportDto.Issue::categoryKey, Collectors.counting()));

        List<ReportDto.CategoryScore> byCategoryWithCounts = byCategory.stream()
            .map(cat -> new ReportDto.CategoryScore(
                cat.key(),
                cat.label(),
                cat.score(),
                issuesByCat.getOrDefault(cat.key(), 0L).intValue()
            ))
            .sorted(Comparator.comparingInt(ReportDto.CategoryScore::issues).reversed())
            .toList();

        String oneLiner = buildOneLiner(global100, byCategoryWithCounts);

        List<ReportDto.Priority> priorities = issues.stream()
            .sorted(Comparator.comparingInt(i -> severityRank(i.severity())))
            .limit(6)
            .map(i -> new ReportDto.Priority(
                i.severity() == ReportDto.IssueSeverity.critical ? ReportDto.Severity.critical :
                    (i.severity() == ReportDto.IssueSeverity.important ? ReportDto.Severity.important : ReportDto.Severity.opportunity),
                i.title(),
                i.impact(),
                i.effort()
            ))
            .toList();

        ReportDto.Tech tech = internalReport.modules().stream()
            .filter(m -> "tech".equals(m.id()))
            .findFirst()
            .map(AuditModuleResult::data)
            .filter(d -> d instanceof Map<?, ?>)
            .map(d -> (Map<String, Object>) d)
            .map(TechReportMapper::fromTechModuleData)
            .orElse(null);

        return new ReportDto(
            Instant.now().toString(),
            domain,
            url,
            new ReportDto.Site(null, null),
            new ReportDto.Scores(global100, byCategoryWithCounts),
            new ReportDto.Summary(oneLiner, priorities),
            issues,
            tech
        );
    }

    private static List<ReportDto.Issue> buildIssues(AuditReportJson internalReport) {
        List<ReportDto.Issue> issues = new ArrayList<>();

        for (AuditModuleResult module : internalReport.modules()) {
            for (AuditCheckResult check : module.checks()) {
                if (check.status() == AuditStatus.PASS || check.status() == AuditStatus.INFO) {
                    continue;
                }

                String categoryKey = pickCategoryKey(module.id(), check.tags());
                ReportDto.IssueSeverity sev = toIssueSeverity(check.status(), check.severity());

                issues.add(new ReportDto.Issue(
                    check.key(),
                    categoryKey,
                    module.id(),
                    sev,
                    check.title() != null ? check.title() : check.key(),
                    check.message() != null ? check.message() : "Point à améliorer détecté.",
                    evidenceFrom(check),
                    check.recommendation() != null ? check.recommendation() : "Corriger selon les bonnes pratiques.",
                    effortFrom(sev)
                ));
            }
        }

        // tri : critical > important > info
        issues.sort(Comparator.comparingInt(i -> severityRank(i.severity())));
        return issues;
    }

    private static String evidenceFrom(AuditCheckResult check) {
        if (check.details() == null || check.details().isEmpty()) return null;
        // MVP : stringify court
        return check.details().toString();
    }

    private static ReportDto.Effort effortFrom(ReportDto.IssueSeverity sev) {
        return switch (sev) {
            case critical -> ReportDto.Effort.M;
            case important -> ReportDto.Effort.S;
            case info -> ReportDto.Effort.XS;
        };
    }

    private static int severityRank(ReportDto.IssueSeverity s) {
        return switch (s) {
            case critical -> 0;
            case important -> 1;
            case info -> 2;
        };
    }

    private static ReportDto.IssueSeverity toIssueSeverity(AuditStatus status, AuditSeverity severity) {
        // MVP : FAIL => critical, WARN => important
        if (status == AuditStatus.FAIL) return ReportDto.IssueSeverity.critical;
        if (status == AuditStatus.WARN) return ReportDto.IssueSeverity.important;
        return ReportDto.IssueSeverity.info;
    }

    private static int toScore100(double ratio) {
        double r = Math.max(0.0, Math.min(1.0, ratio));
        return (int) Math.round(r * 100.0);
    }

    private static String extractDomain(String url) {
        try {
            return URI.create(url).getHost();
        } catch (Exception e) {
            return url;
        }
    }

    private static boolean isBusinessTag(String tag) {
        // on exclut les tags modules si tu les ajoutes (http/html/tech)
        return tag != null && !tag.isBlank()
            && !tag.equals("http")
            && !tag.equals("html")
            && !tag.equals("tech");
    }

    private static String pickCategoryKey(String moduleId, List<String> tags) {
        if (tags != null) {
            for (String t : tags) {
                if (isBusinessTag(t)) return t;
            }
        }
        // fallback : module
        return moduleId;
    }

    private static String labelize(String key) {
        return key.substring(0, 1).toUpperCase(Locale.ROOT) + key.substring(1);
    }

    private static String buildOneLiner(int globalScore, List<ReportDto.CategoryScore> cats) {
        if (globalScore >= 85) return "Site solide : quelques optimisations peuvent encore améliorer l’impact.";
        if (globalScore >= 65) return "Bon potentiel : quelques actions ciblées peuvent améliorer performance et conversion.";
        if (globalScore >= 40) return "Plusieurs points bloquants : une petite roadmap peut rapidement faire monter le score.";
        return "De grosses opportunités : corriger les points critiques pour améliorer confiance et conversion.";
    }
}
