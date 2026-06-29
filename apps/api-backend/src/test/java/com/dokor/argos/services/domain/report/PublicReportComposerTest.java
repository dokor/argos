package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.AuditModuleResult;
import com.dokor.argos.services.analysis.model.AuditReportJson;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.dokor.argos.services.analysis.scoring.AuditScoreReport;
import com.dokor.argos.services.analysis.scoring.ScoreAggregate;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PublicReportComposerTest {

    private final PublicReportComposer composer = new PublicReportComposer();

    // ------------------------------------------------------------------ helpers

    private static AuditCheckResult check(String key, AuditStatus status) {
        return new AuditCheckResult(
            key, "Title for " + key,
            status, AuditSeverity.MEDIUM,
            true, 5.0, List.of("performance"),
            null, Map.of(),
            "Impact message", "Fix this"
        );
    }

    private static AuditModuleResult module(String id, Map<String, Object> data, AuditCheckResult... checks) {
        return new AuditModuleResult(id, id.toUpperCase(), "ok", data, List.of(checks));
    }

    private static AuditReportJson report(List<AuditModuleResult> modules, AuditScoreReport score) {
        return new AuditReportJson(
            4,
            "http://example.com",
            "https://example.com",
            Instant.now(),
            Map.of(),
            modules,
            score
        );
    }

    private static AuditScoreReport scoreOf(double ratio, String... tags) {
        ScoreAggregate global = ScoreAggregate.of("global", ratio * 100, 100);
        List<ScoreAggregate> byTag = new java.util.ArrayList<>();
        for (int i = 0; i < tags.length; i += 2) {
            double tagRatio = Double.parseDouble(tags[i + 1]);
            byTag.add(ScoreAggregate.of(tags[i], tagRatio * 100, 100));
        }
        return new AuditScoreReport(1, global, List.of(), byTag, List.of());
    }

    // ------------------------------------------------------------------ site title

    @Test
    void shouldExtractSiteTitleFromHtmlModule() {
        AuditModuleResult htmlModule = module("html", Map.of("title", "My Website"), check("html.title", AuditStatus.PASS));
        AuditReportJson input = report(List.of(htmlModule), scoreOf(0.8));

        ReportDto dto = composer.compose(input);

        assertNotNull(dto.site());
        assertEquals("My Website", dto.site().title());
    }

    @Test
    void shouldLeaveSiteTitleNullWhenHtmlModuleMissing() {
        AuditReportJson input = report(List.of(module("http", Map.of())), scoreOf(0.5));

        ReportDto dto = composer.compose(input);

        assertNull(dto.site().title());
    }

    @Test
    void shouldLeaveSiteTitleNullWhenHtmlTitleIsBlank() {
        AuditModuleResult htmlModule = module("html", Map.of("title", "   "));
        AuditReportJson input = report(List.of(htmlModule), scoreOf(0.5));

        ReportDto dto = composer.compose(input);

        assertNull(dto.site().title());
    }

    // ------------------------------------------------------------------ tech

    @Test
    void shouldExtractTechFromTechModule() {
        Map<String, Object> techData = Map.of(
            "cms", Map.of("name", "WordPress", "confidence", 0.9)
        );
        AuditModuleResult techModule = module("tech", techData);
        AuditReportJson input = report(List.of(techModule), scoreOf(0.7));

        ReportDto dto = composer.compose(input);

        assertNotNull(dto.tech());
        assertNotNull(dto.tech().cms());
        assertEquals("WordPress", dto.tech().cms().name());
    }

    @Test
    void shouldReturnNullTechWhenTechModuleHasNoCmsAndUnknownFf() {
        Map<String, Object> techData = Map.of(
            "frontendFramework", Map.of("name", "unknown", "confidence", 0.1)
        );
        AuditModuleResult techModule = module("tech", techData);
        AuditReportJson input = report(List.of(techModule), scoreOf(0.6));

        ReportDto dto = composer.compose(input);

        assertNull(dto.tech());
    }

    @Test
    void shouldReturnNullTechWhenTechModuleAbsent() {
        AuditReportJson input = report(List.of(module("html", Map.of())), scoreOf(0.6));

        ReportDto dto = composer.compose(input);

        assertNull(dto.tech());
    }

    // ------------------------------------------------------------------ issues

    @Test
    void shouldConvertFailCheckToCriticalIssue() {
        AuditModuleResult httpModule = module("http", Map.of(), check("http.security.hsts", AuditStatus.FAIL));
        AuditReportJson input = report(List.of(httpModule), scoreOf(0.5));

        ReportDto dto = composer.compose(input);

        assertTrue(dto.issues().stream().anyMatch(i -> i.severity() == ReportDto.IssueSeverity.critical));
    }

    @Test
    void shouldConvertWarnCheckToImportantIssue() {
        AuditModuleResult httpModule = module("http", Map.of(), check("http.security.csp", AuditStatus.WARN));
        AuditReportJson input = report(List.of(httpModule), scoreOf(0.6));

        ReportDto dto = composer.compose(input);

        assertTrue(dto.issues().stream().anyMatch(i -> i.severity() == ReportDto.IssueSeverity.important));
    }

    @Test
    void shouldSkipPassAndInfoChecks() {
        AuditModuleResult module = module("html", Map.of(),
            check("html.title", AuditStatus.PASS),
            check("html.lang",  AuditStatus.INFO)
        );
        AuditReportJson input = report(List.of(module), scoreOf(0.9));

        ReportDto dto = composer.compose(input);

        assertTrue(dto.issues().isEmpty(), "PASS and INFO checks should not appear in issues");
    }

    @Test
    void shouldSortIssuesCriticalFirst() {
        AuditModuleResult module = module("http", Map.of(),
            check("http.warn",  AuditStatus.WARN),
            check("http.fail",  AuditStatus.FAIL)
        );
        AuditReportJson input = report(List.of(module), scoreOf(0.3));

        ReportDto dto = composer.compose(input);

        assertEquals(2, dto.issues().size());
        assertEquals(ReportDto.IssueSeverity.critical, dto.issues().get(0).severity());
        assertEquals(ReportDto.IssueSeverity.important, dto.issues().get(1).severity());
    }

    // ------------------------------------------------------------------ score

    @Test
    void shouldComputeGlobalScoreFrom100() {
        AuditReportJson input = report(List.of(module("html", Map.of())), scoreOf(0.75));

        ReportDto dto = composer.compose(input);

        assertEquals(75, dto.scores().global());
    }

    @Test
    void shouldReturnZeroScoreWhenScoreIsNull() {
        AuditReportJson input = report(List.of(module("html", Map.of())), null);

        ReportDto dto = composer.compose(input);

        assertEquals(0, dto.scores().global());
    }

    @Test
    void shouldFilterOutInternalTagsFromCategoryScores() {
        AuditReportJson input = report(
            List.of(module("html", Map.of())),
            scoreOf(0.6, "performance", "0.6", "http", "0.9", "html", "0.8", "tech", "0.0")
        );

        ReportDto dto = composer.compose(input);

        List<String> catKeys = dto.scores().byCategory().stream().map(ReportDto.CategoryScore::key).toList();
        assertTrue(catKeys.contains("performance"), "performance should be included");
        assertFalse(catKeys.contains("http"),  "http should be excluded (internal)");
        assertFalse(catKeys.contains("html"),  "html should be excluded (internal)");
        assertFalse(catKeys.contains("tech"),  "tech should be excluded (internal)");
    }

    // ------------------------------------------------------------------ domain

    @Test
    void shouldExtractDomainFromUrl() {
        AuditReportJson input = report(List.of(module("html", Map.of())), scoreOf(0.8));

        ReportDto dto = composer.compose(input);

        assertEquals("example.com", dto.domain());
    }
}
