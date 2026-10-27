package com.dokor.argos.services.analysis.modules.tech;

import com.dokor.argos.services.analysis.model.AuditCheckResult;
import com.dokor.argos.services.analysis.model.enums.AuditSeverity;
import com.dokor.argos.services.analysis.model.enums.AuditStatus;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;

/** Passive banner assessment only; never infer a PHP version from a CMS version. */
final class PhpVersionAnalyzer {
    static final String EOL_KEY = "tech.security.php_eol";
    static final String CVE_KEY = "tech.security.php_cves";
    private static final Pattern BANNER = Pattern.compile(
        "(?i)(?<![a-z0-9_])PHP[/ \\t]+(\\d{1,2}\\.\\d{1,2}(?:\\.\\d{1,3})?)(?=$|[-+;,\\s()])");
    private static final Pattern VERSION_HEADER = Pattern.compile(
        "\\s*(\\d{1,2}\\.\\d{1,2}(?:\\.\\d{1,3})?)(?:[-+][a-zA-Z0-9.+~_-]+)?\\s*");
    private static final Pattern PRE_RELEASE_SUFFIX = Pattern.compile("(?i)^[-+]?(?:dev|alpha|beta|rc)(?:[0-9]|\\b)");
    private static final Set<String> PHP_CMS = Set.of("WordPress", "Drupal", "Joomla", "PrestaShop", "Magento", "TYPO3");
    private static final Catalogue CATALOGUE = loadCatalogue();
    private final Clock clock;

    PhpVersionAnalyzer() { this(Clock.systemUTC()); }
    PhpVersionAnalyzer(Clock clock) { this.clock = clock; }

    Assessment analyze(Map<String, String> headers, String cms) {
        Set<String> versions = new TreeSet<>();
        Set<String> sources = new TreeSet<>();
        boolean detected = PHP_CMS.contains(cms == null ? "" : cms);
        for (var entry : headers.entrySet()) {
            String name = entry.getKey().toLowerCase(Locale.ROOT);
            String value = entry.getValue();
            if (value == null || !Set.of("server", "x-powered-by", "x-php-version").contains(name)) continue;
            var match = (name.equals("x-php-version") ? VERSION_HEADER : BANNER).matcher(value);
            while (match.find()) {
                if (PRE_RELEASE_SUFFIX.matcher(value.substring(match.end(1))).find()) continue;
                versions.add(match.group(1));
                sources.add(name);
                detected = true;
            }
            if (name.equals("x-powered-by") && value.matches("(?is).*\\bPHP\\b.*")) detected = true;
        }
        if (!detected) return new Assessment(Map.of(), List.of());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("detected", true);
        data.put("sourceHeaders", List.copyOf(sources));
        if (!sources.isEmpty()) data.put("responseHeader", String.join(", ", sources));
        data.put("supportSource", CATALOGUE.supportSource());
        data.put("supportVerifiedAt", CATALOGUE.supportVerifiedAt());
        data.put("advisoriesVerifiedAt", CATALOGUE.advisoriesVerifiedAt());
        if (versions.size() != 1) {
            data.put("versionStatus", versions.isEmpty() ? "NOT_EXPOSED" : "CONFLICTING_BANNERS");
            data.put("observedVersions", List.copyOf(versions));
            return new Assessment(data, List.of());
        }
        String version = versions.iterator().next();
        data.put("versionStatus", "OBSERVED");
        data.put("phpVersion", version);
        String[] parts = version.split("\\.");
        Branch branch = CATALOGUE.branches().get(parts[0] + "." + parts[1]);
        LocalDate today = LocalDate.now(clock);
        boolean legacy = Set.of("4", "5", "7").contains(parts[0]);
        String support = branch == null ? (legacy ? "END_OF_LIFE" : "UNKNOWN")
            : today.isAfter(LocalDate.parse(branch.securityUntil())) ? "END_OF_LIFE"
            : today.isAfter(LocalDate.parse(branch.activeUntil())) ? "SECURITY_ONLY" : "ACTIVE";
        data.put("supportStatus", support);
        if (branch != null) data.put("securitySupportUntil", branch.securityUntil());

        var matches = parts.length != 3 ? List.<Advisory>of() : CATALOGUE.advisories().stream()
            .filter(advisory -> advisory.ranges().stream().anyMatch(range -> range.contains(version))).toList();
        data.put("cves", matches.stream().map(Advisory::cve).distinct().toList());
        data.put("advisoryUrls", matches.stream().map(Advisory::url).distinct().toList());
        data.put("cveAssessment", parts.length == 3 ? "VERSION_MATCH_ONLY" : "PATCH_VERSION_NOT_EXPOSED");
        data.put("confidence", "MEDIUM");
        String limitation = "La bannière peut être modifiée par un proxy. Vérifiez la version exécutée, "
            + "les extensions, la configuration et les correctifs rétroportés de l’hébergeur avant de conclure à une vulnérabilité exploitable.";
        data.put("limitations", limitation);
        var checks = new ArrayList<AuditCheckResult>();
        if (!support.equals("UNKNOWN")) {
            boolean eol = support.equals("END_OF_LIFE");
            checks.add(AuditCheckResult.of(EOL_KEY, "PHP " + version + " : maintenance de sécurité",
                eol ? AuditStatus.FAIL : AuditStatus.PASS, AuditSeverity.MEDIUM,
                true, 0, List.of("security", "tech"), version, new LinkedHashMap<>(data),
                eol ? "PHP " + version + " est exposé dans la réponse HTTP. Cette branche n’est plus maintenue par PHP."
                    : "PHP " + version + " appartient à une branche encore maintenue pour la sécurité.",
                eol ? "Vérifiez la version PHP dans l’administration de l’hébergement, puis migrez vers une branche maintenue "
                    + "avec ses derniers correctifs, après avoir testé le CMS, ses thèmes et extensions. " + limitation : null));
        }
        if (parts.length == 3) {
            boolean vulnerable = !matches.isEmpty();
            checks.add(AuditCheckResult.of(CVE_KEY, "PHP " + version + " : CVE connues à vérifier",
                vulnerable ? AuditStatus.WARN : AuditStatus.PASS,
                matches.stream().anyMatch(a -> Set.of("high", "critical").contains(a.severity())) ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
                true, 0, List.of("security", "tech"), version, new LinkedHashMap<>(data),
                vulnerable ? "La version exposée PHP " + version + " correspond aux plages concernées par " + matches.size()
                    + " avis de sécurité PHP (dont " + String.join(", ", matches.stream().limit(5).map(Advisory::cve).toList()) + "). " + limitation
                    : "Aucune CVE correspondante dans le catalogue PHP vérifié le " + CATALOGUE.advisoriesVerifiedAt()
                        + ". Cela ne garantit pas l’absence de vulnérabilité.",
                vulnerable ? "Consultez les avis PHP référencés et les bulletins de l’hébergeur, puis installez une version maintenue "
                    + "qui inclut les correctifs applicables. Testez le CMS, les thèmes et extensions avant la mise à jour. " + limitation : null));
        }
        return new Assessment(data, List.copyOf(checks));
    }

    private static Catalogue loadCatalogue() {
        try (var stream = PhpVersionAnalyzer.class.getResourceAsStream("/tech/php-security.json")) {
            if (stream == null) throw new IllegalStateException("Missing PHP security catalogue");
            return new ObjectMapper().readValue(stream, Catalogue.class);
        } catch (IOException failure) { throw new IllegalStateException("Invalid PHP security catalogue", failure); }
    }

    static int compare(String a, String b) {
        String[] left = a.split("\\."), right = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int difference = Integer.compare(Integer.parseInt(left[i]), Integer.parseInt(right[i]));
            if (difference != 0) return difference;
        }
        return 0;
    }

    record Assessment(Map<String, Object> data, List<AuditCheckResult> checks) {}
    record Catalogue(String supportVerifiedAt, String supportSource, String advisoriesVerifiedAt,
                     Map<String, Branch> branches, List<Advisory> advisories) {}
    record Branch(String activeUntil, String securityUntil) {}
    record Advisory(String cve, String url, String severity, List<VersionRange> ranges) {}
    record VersionRange(String from, String to, boolean includeFrom, boolean includeTo) {
        boolean contains(String version) {
            int lower = compare(version, from), upper = compare(version, to);
            return (lower > 0 || (lower == 0 && includeFrom)) && (upper < 0 || (upper == 0 && includeTo));
        }
    }
}
