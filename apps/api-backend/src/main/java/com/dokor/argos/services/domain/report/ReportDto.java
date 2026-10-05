package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.accessibility.AccessibilityEvidence;
import com.dokor.argos.services.analysis.accessibility.AccessibilityCompliance;
import java.util.List;

public record ReportDto(
    String generatedAt,
    String domain,
    String url,
    Site site,
    Scores scores,
    Summary summary,
    List<Issue> issues,
    Tech tech,
    AntiBot antiBot,   // non nul uniquement si une protection anti-bot a été détectée (#195)
    AccessibilityEvidence accessibilityEvidence,
    AccessibilityCompliance accessibilityCompliance
) {
    public ReportDto(String generatedAt, String domain, String url, Site site, Scores scores,
                     Summary summary, List<Issue> issues, Tech tech, AntiBot antiBot) {
        this(generatedAt, domain, url, site, scores, summary, issues, tech, antiBot, null, null);
    }
    public ReportDto(String generatedAt, String domain, String url, Site site, Scores scores,
                     Summary summary, List<Issue> issues, Tech tech, AntiBot antiBot,
                     AccessibilityEvidence accessibilityEvidence) {
        this(generatedAt, domain, url, site, scores, summary, issues, tech, antiBot, accessibilityEvidence, null);
    }
    public record Site(String title, String logoUrl) {
    }

    /** Signale une protection anti-bot (Cloudflare…) : l'analyse peut être partielle. */
    public record AntiBot(boolean detected, String vendor) {
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
        Integer completeness, // 0..100 : part des modules évalués (null si inconnu). Voir issue #101.
        List<CategoryScore> byCategory,
        Boolean globalAvailable, // null pour les rapports historiques
        ScoreCalculation calculation,
        com.dokor.argos.services.analysis.scoring.MeasurementCoverage coverage
    ) {
        public Scores(int global,Integer completeness,List<CategoryScore> categories,Boolean available,ScoreCalculation calculation) {
            this(global,completeness,categories,available,calculation,null);
        }
        public Scores(int global, Integer completeness, List<CategoryScore> byCategory) {
            this(global, completeness, byCategory, null, null);
        }
    }

    public record ScoreCalculation(
        int scoringVersion,
        String scoringFingerprint,
        List<DomainCalculation> domains
    ) {}

    public record DomainCalculation(
        String key, double score, double maxScore, double ratio, double effectiveWeight
    ) {}

    public record CategoryScore(
        String key,
        String label,
        int score,
        int issues
    ) {
    }

    public record Summary(
        String oneLiner,
        List<Priority> priorities,
        AiSummary ai
    ) {
    }

    public record AiSummary(
        AiSummaryLocale fr,
        AiSummaryLocale en
    ) {
    }

    public record AiSummaryLocale(
        String headline,
        String summary,
        List<String> keyPoints
    ) {
    }

    public record Priority(
        Severity severity, // critical|important|opportunity
        String title,
        String impact,
        Effort effort,
        String findingKey,
        String categoryKey,
        List<String> sources,
        String rootCauseKey,
        List<String> relatedFindingKeys,
        int rank,
        String rankingVersion,
        String rankReason,
        String confidence,
        Double scoreLoss,
        Double domainScoreGain,
        Double globalScoreGain
    ) {
        public Priority(Severity severity, String title, String impact, Effort effort) {
            this(severity, title, impact, effort, null, null, null, null, null,
                0, null, null, null, null, null, null);
        }
    }

    public record Issue(
        String id,
        String categoryKey,        // catégorie principale (rétro-compat)
        List<String> categoryKeys, // toutes les catégories métier auxquelles le point appartient
        String module,
        IssueSeverity severity, // critical|important|info
        String title,
        String impact,
        String evidence,
        String recommendation,
        Effort effort,
        String confidence
    ) {
        public Issue(String id,String category,List<String> categories,String module,IssueSeverity severity,
            String title,String impact,String evidence,String recommendation,Effort effort) {
            this(id,category,categories,module,severity,title,impact,evidence,recommendation,effort,"UNKNOWN");
        }
    }

    public enum Severity {critical, important, opportunity}

    public enum IssueSeverity {critical, important, info}

    public enum Effort {XS, S, M, L}
}
