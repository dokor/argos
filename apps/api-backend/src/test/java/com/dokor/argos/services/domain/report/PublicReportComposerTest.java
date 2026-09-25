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

    // ---------------------------------------------------- anti-bot (issue #195)

    @Test
    void shouldExposeAntiBotWhenDetectedInMeta() {
        AuditReportJson input = report(
            List.of(module("http", Map.of())),
            scoreOf(0.5),
            Map.of("antiBotDetected", "true", "antiBotVendor", "cloudflare"));

        ReportDto dto = composer.compose(input);

        assertNotNull(dto.antiBot());
        assertTrue(dto.antiBot().detected());
        assertEquals("cloudflare", dto.antiBot().vendor());
    }

    @Test
    void shouldNotExposeAntiBotWhenAbsent() {
        AuditReportJson input = report(List.of(module("html", Map.of())), scoreOf(0.8));

        assertNull(composer.compose(input).antiBot());
    }

    // ------------------------------------------------------------------ helpers

    private static AuditCheckResult check(String key, AuditStatus status) {
        return check(key, status, AuditSeverity.MEDIUM);
    }

    private static AuditCheckResult check(String key, AuditStatus status, AuditSeverity severity) {
        return AuditCheckResult.of(
            key, "Title for " + key,
            status, severity,
            true, 5.0, List.of("performance"),
            null, Map.of(),
            "Impact message", "Fix this"
        );
    }

    private static AuditCheckResult checkWithTags(String key, AuditStatus status, List<String> tags) {
        return AuditCheckResult.of(
            key, "Title for " + key,
            status, AuditSeverity.MEDIUM,
            true, 5.0, tags,
            null, Map.of(),
            "Impact message", "Fix this"
        );
    }

    private static AuditModuleResult module(String id, Map<String, Object> data, AuditCheckResult... checks) {
        return new AuditModuleResult(id, id.toUpperCase(), "ok", data, List.of(checks));
    }

    private static AuditReportJson report(List<AuditModuleResult> modules, AuditScoreReport score) {
        return report(modules, score, Map.of());
    }

    private static AuditReportJson report(List<AuditModuleResult> modules, AuditScoreReport score, Map<String, String> meta) {
        return new AuditReportJson(
            4,
            "http://example.com",
            "https://example.com",
            Instant.now(),
            meta,
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
        // Un check FAIL de sévérité HIGH devient un point "critical" (cf. toIssueSeverity).
        AuditModuleResult httpModule = module("http", Map.of(),
            check("http.security.hsts", AuditStatus.FAIL, AuditSeverity.HIGH));
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
        // FAIL+HIGH ⇒ critical, WARN+MEDIUM ⇒ important : le critical doit être trié en premier.
        AuditModuleResult module = module("http", Map.of(),
            check("http.warn",  AuditStatus.WARN),
            check("http.fail",  AuditStatus.FAIL, AuditSeverity.HIGH)
        );
        AuditReportJson input = report(List.of(module), scoreOf(0.3));

        ReportDto dto = composer.compose(input);

        assertEquals(2, dto.issues().size());
        assertEquals(ReportDto.IssueSeverity.critical, dto.issues().get(0).severity());
        assertEquals(ReportDto.IssueSeverity.important, dto.issues().get(1).severity());
    }

    @Test
    void sslIssueShouldBucketOnlyUnderSecurityDomain() {
        // #197 : catégories par domaine. Un check SSL (tags security+ssl) n'apparaît que
        // sous le domaine "security" ; "ssl" (outil) n'est plus une catégorie -> pas de
        // doublon Sécurité/SSL.
        AuditModuleResult sslModule = module("ssl", Map.of(),
            checkWithTags("ssl.grade", AuditStatus.FAIL, List.of("security", "ssl")));
        AuditReportJson input = report(List.of(sslModule),
            scoreOf(0.46, "security", "0.76", "ssl", "0.46"));

        ReportDto dto = composer.compose(input);

        ReportDto.Issue issue = dto.issues().stream()
            .filter(i -> "ssl.grade".equals(i.id()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("ssl.grade issue not found"));
        assertTrue(issue.categoryKeys().contains("security"), "issue should belong to security domain");
        assertFalse(issue.categoryKeys().contains("ssl"), "ssl (outil) ne doit plus être une catégorie (#197)");

        List<String> catKeys = dto.scores().byCategory().stream().map(ReportDto.CategoryScore::key).toList();
        assertTrue(catKeys.contains("security"), "le domaine security doit être présent");
        assertFalse(catKeys.contains("ssl"), "l'outil ssl ne doit pas être une catégorie (#197)");
    }

    @Test
    void canonicalBusinessTagsShouldKeepFallbackAndLighthouseIssuesVisible() {
        AuditModuleResult module = module("lighthouse", Map.of(),
            checkWithTags("http.status_code", AuditStatus.FAIL, List.of("performance", "http")),
            checkWithTags("lighthouse.audit.color-contrast", AuditStatus.FAIL, List.of("a11y", "lighthouse", "accessibility")),
            checkWithTags("lighthouse.audit.no-vulnerable-libraries", AuditStatus.FAIL, List.of("security", "lighthouse", "best-practices"))
        );
        AuditReportJson input = report(List.of(module), scoreOf(0.4,
            "performance", "0.4", "a11y", "0.4", "security", "0.4"));

        ReportDto dto = composer.compose(input);

        assertEquals(List.of("performance"), issueCategoryKeys(dto, "http.status_code"));
        assertEquals(List.of("a11y"), issueCategoryKeys(dto, "lighthouse.audit.color-contrast"));
        assertEquals(List.of("security"), issueCategoryKeys(dto, "lighthouse.audit.no-vulnerable-libraries"));
    }

    private static List<String> issueCategoryKeys(ReportDto dto, String issueId) {
        return dto.issues().stream()
            .filter(issue -> issueId.equals(issue.id()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Issue not found: " + issueId))
            .categoryKeys();
    }

    // ------------------------------------------------------------------ score

    @Test
    void shouldExposeCompletenessFromMeta() {
        // issue #101 : la complétude accompagne le score (analyse partielle identifiable).
        AuditReportJson input = report(
            List.of(module("html", Map.of())),
            scoreOf(0.8),
            Map.of("completeness", "75"));

        ReportDto dto = composer.compose(input);

        assertEquals(75, dto.scores().completeness());
    }

    @Test
    void shouldLeaveCompletenessNullWhenAbsentFromMeta() {
        AuditReportJson input = report(List.of(module("html", Map.of())), scoreOf(0.8));

        ReportDto dto = composer.compose(input);

        assertNull(dto.scores().completeness());
    }

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
    void shouldKeepOnlyDomainCategories() {
        // #197 : seules les 4 catégories de domaine sont exposées ; les tags de module
        // (http/html/tech) ET d'outil (ssl/lighthouse/observatory/zap/runtime) sont exclus.
        AuditReportJson input = report(
            List.of(module("html", Map.of())),
            scoreOf(0.6,
                "performance", "0.6", "http", "0.9", "html", "0.8", "tech", "0.0",
                "ssl", "0.5", "lighthouse", "0.7", "runtime", "0.5")
        );

        ReportDto dto = composer.compose(input);

        List<String> catKeys = dto.scores().byCategory().stream().map(ReportDto.CategoryScore::key).toList();
        assertTrue(catKeys.contains("performance"), "performance (domaine) doit être inclus");
        assertFalse(catKeys.contains("http"),  "http exclu (module)");
        assertFalse(catKeys.contains("html"),  "html exclu (module)");
        assertFalse(catKeys.contains("tech"),  "tech exclu (module)");
        assertFalse(catKeys.contains("ssl"),        "ssl exclu (outil, #197)");
        assertFalse(catKeys.contains("lighthouse"), "lighthouse exclu (outil, #197)");
        assertFalse(catKeys.contains("runtime"),    "runtime exclu (outil, #197)");
    }

    @Test
    void shouldPreferNormalizedDomainAggregatesForNewReports() {
        ScoreAggregate global = ScoreAggregate.of("global", 75.0, 100.0);
        AuditScoreReport score = new AuditScoreReport(
            10,
            global,
            List.of(),
            List.of(ScoreAggregate.of("performance", 10.0, 100.0)),
            List.of(
                ScoreAggregate.of("performance", 90.0, 100.0),
                ScoreAggregate.of("security", 60.0, 100.0),
                ScoreAggregate.of("seo", 0.0, 0.0),
                ScoreAggregate.of("a11y", 0.0, 0.0)
            ),
            Map.of("performance", 0.5, "security", 0.5, "seo", 0.0, "a11y", 0.0),
            List.of()
        );

        ReportDto dto = composer.compose(report(List.of(module("html", Map.of())), score));

        assertEquals(90, categoryScore(dto, "performance"));
        assertEquals(60, categoryScore(dto, "security"));
        assertEquals(2, dto.scores().byCategory().size());
    }

    private static int categoryScore(ReportDto dto, String key) {
        return dto.scores().byCategory().stream()
            .filter(category -> key.equals(category.key()))
            .findFirst()
            .orElseThrow()
            .score();
    }

    // ------------------------------------------------------------------ domain

    @Test
    void shouldExtractDomainFromUrl() {
        AuditReportJson input = report(List.of(module("html", Map.of())), scoreOf(0.8));

        ReportDto dto = composer.compose(input);

        assertEquals("example.com", dto.domain());
    }
}
