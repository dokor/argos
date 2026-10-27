package com.dokor.argos.services.analysis.modules.tech;

import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PhpVersionAnalyzerTest {
    private final PhpVersionAnalyzer analyzer = at("2026-10-27");
    private static PhpVersionAnalyzer at(String day) {
        return new PhpVersionAnalyzer(Clock.fixed(Instant.parse(day + "T12:00:00Z"), ZoneOffset.UTC));
    }

    @Test void detectsEolPhpForWordpressAndOtherCmsWithoutGuessingFromCmsVersion() {
        for (String cms : List.of("WordPress", "Drupal", "Joomla", "PrestaShop", "Magento", "TYPO3")) {
            var result = analyzer.analyze(Map.of("X-Powered-By", "PHP/7.4.33"), cms);
            assertEquals("7.4.33", result.data().get("phpVersion"));
            assertEquals("END_OF_LIFE", result.data().get("supportStatus"));
            assertEquals(AuditStatus.FAIL, result.checks().getFirst().status());
            assertTrue(result.checks().getFirst().title().contains("7.4.33"));
            assertTrue(analyzer.analyze(Map.of(), cms).checks().isEmpty());
            assertEquals("NOT_EXPOSED", analyzer.analyze(Map.of(), cms).data().get("versionStatus"));
        }
    }

    @Test void detectsPhpFromSupportedHeadersEvenWithoutCmsAndPreservesNoRawHeaders() {
        for (var headers : List.of(Map.of("server", "Apache/2.4 PHP/8.2.34"),
            Map.of("x-php-version", "8.2.34-1ubuntu1"), Map.of("x-powered-by", "PHP/8.2.34, Express"))) {
            var result = analyzer.analyze(headers, null);
            assertEquals("8.2.34", result.data().get("phpVersion"));
            assertFalse(result.data().toString().contains("ubuntu"));
        }
    }

    @Test void distinguishesSecurityOnlyFromEolAtTheExactEndOfSupportBoundary() {
        var headers = Map.of("x-powered-by", "PHP/8.2.35");
        assertEquals("SECURITY_ONLY", at("2026-12-31").analyze(headers, null).data().get("supportStatus"));
        assertEquals("END_OF_LIFE", at("2027-01-01").analyze(headers, null).data().get("supportStatus"));
        assertEquals("ACTIVE", analyzer.analyze(Map.of("x-powered-by", "PHP/8.5.12"), null).data().get("supportStatus"));
    }

    @Test void matchesCurrentAdvisoriesOnlyBeforeTheFixOnTheSameBranch() {
        for (String version : List.of("8.2.34", "8.3.35", "8.4.26", "8.5.11")) {
            var result = analyzer.analyze(Map.of("x-powered-by", "PHP/" + version), "WordPress");
            assertTrue(((List<?>) result.data().get("cves")).contains("CVE-2026-109618"), version);
            assertEquals(AuditStatus.WARN, result.checks().getLast().status());
        }
        for (String version : List.of("8.2.35", "8.3.36", "8.4.27", "8.5.12")) {
            var result = analyzer.analyze(Map.of("x-powered-by", "PHP/" + version), "Drupal");
            assertEquals(List.of(), result.data().get("cves"), version);
            assertTrue(result.checks().stream().allMatch(c -> c.status() == AuditStatus.PASS));
        }
    }

    @Test void partialAndUnknownVersionsNeverInventCveOrMaintenanceStatus() {
        var partial = analyzer.analyze(Map.of("x-powered-by", "PHP/7.4"), "WordPress");
        assertEquals("END_OF_LIFE", partial.data().get("supportStatus"));
        assertEquals(1, partial.checks().size());
        var future = analyzer.analyze(Map.of("x-powered-by", "PHP/9.0.0"), null);
        assertEquals("UNKNOWN", future.data().get("supportStatus"));
        assertTrue(future.checks().stream().noneMatch(c -> c.key().equals(PhpVersionAnalyzer.EOL_KEY)));
        assertTrue(analyzer.analyze(Map.of("set-cookie", "PHPSESSID=8.1.0"), null).checks().isEmpty());
        for (String value : List.of("PHP", "NotPHP/7.4.33", "PHP/8.3.12RC1", "PHP/8.3.12.99",
            "PHP/8.3.12-dev", "PHP/8.3.12-RC1", "PHP/8.3.12-beta2"))
            assertTrue(analyzer.analyze(Map.of("x-powered-by", value), "WordPress").checks().isEmpty(), value);
        assertTrue(analyzer.analyze(Map.of("x-php-version", "8.3.12-dev"), "Drupal").checks().isEmpty());
    }

    @Test void conflictingBannersAreNotTreatedAsOneConfirmedVersion() {
        var result = analyzer.analyze(Map.of("server", "PHP/7.4.33", "x-powered-by", "PHP/8.5.12"), "WordPress");
        assertEquals("CONFLICTING_BANNERS", result.data().get("versionStatus"));
        assertTrue(result.checks().isEmpty());
    }

    @Test void numericRangesHandleDoubleDigitPatchesAndInclusiveExclusiveBounds() {
        var range = new PhpVersionAnalyzer.VersionRange("8.1.11", "8.1.28", false, false);
        assertFalse(range.contains("8.1.11"));
        assertTrue(range.contains("8.1.12"));
        assertFalse(range.contains("8.1.28"));
        assertFalse(range.contains("8.2.0"));
        assertTrue(new PhpVersionAnalyzer.VersionRange("8.2.0", "8.2.12", true, true).contains("8.2.12"));
        assertTrue(PhpVersionAnalyzer.compare("8.2.9", "8.2.10") < 0);
    }
}
