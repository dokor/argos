package com.dokor.argos.services.analysis;

import com.dokor.argos.services.analysis.model.*;
import com.dokor.argos.services.analysis.model.enums.*;
import com.dokor.argos.services.analysis.scoring.*;
import com.dokor.argos.services.domain.report.PublicReportComposer;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class CheckMergerServiceTest {
    private static final String HSTS = "http.security.hsts";
    private static final List<String> OWNED_KEYS = List.of(HSTS, "http.security.csp",
        "http.security.x_content_type_options", "http.security.x_frame_options",
        "http.security.referrer_policy", "http.security.permissions_policy");
    private final CheckMergerService merger = new CheckMergerService();

    private enum Owner { ABSENT, WITHOUT_CHECK, WITH_CHECK }

    @Test
    void retainsEveryObservedKeyWithOrWithoutItsOwnerInEveryModuleOrder() {
        for (var owner : Owner.values()) {
            var ssl = module("ssl", OWNED_KEYS.stream()
                .map(key -> check(key, AuditStatus.WARN, AuditSeverity.HIGH, "ssl")).toList());
            var zap = module("zap", OWNED_KEYS.stream()
                .map(key -> check(key, AuditStatus.FAIL, AuditSeverity.MEDIUM, "zap")).toList());
            var raw = new ArrayList<>(List.of(ssl, zap));
            if (owner != Owner.ABSENT) raw.add(module("http", owner == Owner.WITH_CHECK
                ? OWNED_KEYS.stream().map(key -> check(key, AuditStatus.PASS, AuditSeverity.LOW, "http")).toList()
                : List.of()));

            List<AuditCheckResult> reference = null;
            for (var permutation : permutations(raw)) {
                var merged = merger.merge(permutation);
                var checks = merged.stream().flatMap(m -> m.checks().stream())
                    .sorted(Comparator.comparing(AuditCheckResult::key)).toList();
                assertEquals(OWNED_KEYS.size(), checks.size(), owner.name());
                assertEquals(new TreeSet<>(OWNED_KEYS), new TreeSet<>(checks.stream().map(AuditCheckResult::key).toList()));
                if (reference == null) reference = checks;
                else assertEquals(reference, checks, "Fusion must be independent of module order");
                for (var key : OWNED_KEYS) {
                    var carrier = merged.stream().filter(m -> m.checks().stream().anyMatch(c -> key.equals(c.key())))
                        .findFirst().orElseThrow();
                    assertEquals(owner == Owner.WITH_CHECK ? "http" : "zap", carrier.id());
                    var check = carrier.checks().stream().filter(c -> key.equals(c.key())).findFirst().orElseThrow();
                    assertEquals(AuditStatus.FAIL, check.status());
                    assertEquals(AuditSeverity.HIGH, check.severity());
                    assertEquals("zap message", check.message());
                    assertEquals("zap fix", check.recommendation());
                    assertEquals("zap value", check.value());
                    assertEquals("ssl evidence", check.details().get("ssl"));
                    assertEquals("zap evidence", check.details().get("zap"));
                    var expectedSources = new TreeSet<>(List.of("ssl", "zap", "ssl-scanner", "zap-scanner"));
                    if (owner == Owner.WITH_CHECK) {
                        expectedSources.addAll(List.of("http", "http-scanner"));
                        assertEquals("http evidence", check.details().get("http"));
                    }
                    assertEquals(List.copyOf(expectedSources), check.sources());
                    assertEquals("zap", check.measurementProvenance().module());
                    assertEquals(owner == Owner.WITH_CHECK ? List.of("http", "ssl", "zap") : List.of("ssl", "zap"),
                        check.measurementProvenance().sources());
                }
            }
        }
    }

    @Test
    void fallbackFindingContributesOnceToScoreIssuesAndPriorities() {
        var policy = new DefaultScorePolicy();
        for (var owner : Owner.values()) {
            var raw = new ArrayList<>(List.of(
                module("ssl", List.of(check(HSTS, AuditStatus.WARN, AuditSeverity.HIGH, "ssl"))),
                module("zap", List.of(check(HSTS, AuditStatus.FAIL, AuditSeverity.MEDIUM, "zap")))));
            if (owner != Owner.ABSENT) raw.add(module("http", owner == Owner.WITH_CHECK
                ? List.of(check(HSTS, AuditStatus.PASS, AuditSeverity.LOW, "http")) : List.of()));
            for (var permutation : permutations(raw)) {
                var enriched = new ScoreEnricherService(policy).enrich(merger.merge(permutation));
                var score = new ScoreService(policy).compute(policy.version(), policy.fingerprint(), enriched);
                assertEquals(1, score.checks().size());
                assertEquals(8.0, score.checks().getFirst().weight());
                assertEquals(100.0, score.global().maxScore());
                assertEquals(0.0, score.global().score());
                var report = new PublicReportComposer().compose(new AuditReportJson(4,
                    "https://example.com", "https://example.com", Instant.EPOCH, Map.of(), enriched, score));
                assertEquals(1, report.issues().size());
                assertEquals(1, report.summary().priorities().size());
            }
        }
    }

    @Test
    void retainsSingleObservationAndDeduplicatesKeysWithoutConfiguredOwner() {
        var single = merger.merge(List.of(module("ssl",
            List.of(check(HSTS, AuditStatus.WARN, AuditSeverity.HIGH, "ssl")))));
        assertEquals(1, single.getFirst().checks().size());
        assertEquals(AuditStatus.WARN, single.getFirst().checks().getFirst().status());
        assertEquals(List.of("ssl", "ssl-scanner"), single.getFirst().checks().getFirst().sources());

        var ssl = module("ssl", List.of(check("custom.key", AuditStatus.FAIL, AuditSeverity.HIGH, "ssl")));
        var zap = module("zap", List.of(check("custom.key", AuditStatus.FAIL, AuditSeverity.MEDIUM, "zap")));
        for (var order : permutations(List.of(ssl, zap))) {
            var merged = merger.merge(order);
            assertEquals(1, merged.stream().mapToInt(m -> m.checks().size()).sum());
            assertEquals(1, merged.stream().filter(m -> m.id().equals("ssl")).findFirst().orElseThrow().checks().size());
        }
    }

    private static AuditCheckResult check(String key, AuditStatus status, AuditSeverity severity, String source) {
        return AuditCheckResult.of(key, key, status, severity, true, 8, List.of("security"),
            source + " value", Map.of(source, source + " evidence"), source + " message", source + " fix")
            .withSources(List.of(source + "-scanner"));
    }

    private static AuditModuleResult module(String id, List<AuditCheckResult> checks) {
        return new AuditModuleResult(id, id, "fixture", Map.of(), checks);
    }

    private static List<List<AuditModuleResult>> permutations(List<AuditModuleResult> modules) {
        if (modules.isEmpty()) return List.of(List.of());
        var result = new ArrayList<List<AuditModuleResult>>();
        for (int i = 0; i < modules.size(); i++) {
            var rest = new ArrayList<>(modules);
            var first = rest.remove(i);
            for (var tail : permutations(rest)) {
                var order = new ArrayList<AuditModuleResult>();
                order.add(first);
                order.addAll(tail);
                result.add(List.copyOf(order));
            }
        }
        return result;
    }
}
