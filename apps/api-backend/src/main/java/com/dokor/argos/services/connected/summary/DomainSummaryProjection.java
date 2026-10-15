package com.dokor.argos.services.connected.summary;

import com.dokor.argos.db.dao.DomainSummaryDao.Row;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.connected.batch.BatchState;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

/** Pure aggregation of the complete selected batch, before filtering/pagination. */
public final class DomainSummaryProjection {
    private DomainSummaryProjection() {}

    public record Page(PageResult result, DiagnosticProjection diagnostic) {}

    public static Page page(Row row, ObjectMapper mapper) {
        var s = row.state();
        var d = DiagnosticProjection.unknown();
        if (s.reportAvailable() && row.diagnostic() != null)
            try {
                var parsed = mapper.readValue(row.diagnostic(), DiagnosticProjection.class);
                if (parsed.version() == 2 && parsed.rules() != null) d = parsed;
            } catch (java.io.IOException ignored) {
            }
        var modules = new TreeMap<String, ModuleStatus>();
        if (row.modules() != null)
            try {
                for (var m : mapper.readTree(row.modules())) {
                    String id = m.path("id").asText();
                    if (id.matches("[a-z0-9_-]{1,32}"))
                        try {
                            modules.put(id, ModuleStatus.valueOf(m.path("status").asText()));
                        } catch (IllegalArgumentException ignored) {
                        }
                }
            } catch (java.io.IOException ignored) {
            }
        boolean published = s.reportAvailable() && s.status().equals("COMPLETED");
        String reason =
                published
                        ? row.score() == null ? "SCORE_UNAVAILABLE" : null
                        : s.status().equals("COMPLETED")
                                ? "REPORT_UNAVAILABLE"
                                : s.status().equals("FAILED")
                                        ? "ANALYSIS_FAILED"
                                        : s.status().equals("CANCELED")
                                                ? "ANALYSIS_CANCELED"
                                                : "ANALYSIS_PENDING";
        var result =
                new PageResult(
                        Long.toString(s.id()),
                        s.url(),
                        Long.toString(s.runId()),
                        ExecutionStatus.valueOf(s.status()),
                        Completeness.valueOf(s.completeness()),
                        new Score(
                                published ? row.score() : null,
                                published && row.provisional(),
                                reason),
                        new Coverage(d.coverageRatio(), d.coverageVersion()),
                        published && d.available() ? d.criticalCount() : null,
                        published && d.available() ? d.importantCount() : null,
                        modules,
                        s.status().equals("FAILED") ? "ANALYSIS_FAILED" : null,
                        published);
        return new Page(result, published ? d : DiagnosticProjection.unknown());
    }

    public static boolean priority(PageResult p) {
        return p.criticalCount() != null && p.criticalCount() > 0
                || p.importantCount() != null && p.importantCount() > 0;
    }

    public static boolean incomplete(PageResult p) {
        return p.executionStatus() != ExecutionStatus.QUEUED
                && p.executionStatus() != ExecutionStatus.RUNNING
                && (p.completeness() != Completeness.FULL
                        || !p.reportAvailable()
                        || p.criticalCount() == null);
    }

    public static final Comparator<PageResult> URL =
            Comparator.comparing(PageResult::normalizedUrl)
                    .thenComparing(p -> Long.parseLong(p.pageId()));
    public static final Comparator<PageResult> PRIORITY =
            Comparator.comparing(
                            PageResult::criticalCount,
                            Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(
                            PageResult::importantCount,
                            Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(URL);

    public static BatchCounts counts(BatchState.Snapshot state, List<Row> rows) {
        var c = state.counts();
        long priorities =
                rows.stream()
                        .filter(
                                r ->
                                        r.state().reportAvailable()
                                                && r.state().status().equals("COMPLETED")
                                                && (r.critical() != null && r.critical() > 0
                                                        || r.important() != null
                                                                && r.important() > 0))
                        .count();
        return new BatchCounts(
                c.selected(),
                c.full(),
                c.partial(),
                c.failed(),
                c.canceled(),
                c.queued() + c.running(),
                priorities,
                c.unknown());
    }

    public static List<CommonFinding> common(List<Page> pages) {
        pages = pages.stream().sorted(Comparator.comparing(Page::result, URL)).toList();
        record Key(String rule, String definition) {}
        var groups =
                new TreeMap<Key, DiagnosticProjection.Rule>(
                        Comparator.comparing(Key::rule).thenComparing(Key::definition));
        for (var p : pages)
            for (var r : p.diagnostic().rules())
                if (r.outcome().equals("FAIL"))
                    groups.merge(
                            new Key(r.key(), r.definitionVersion()),
                            r,
                            (a, b) ->
                                    DiagnosticProjection.rank(a.severity())
                                                    <= DiagnosticProjection.rank(b.severity())
                                            ? a
                                            : b);
        var result = new ArrayList<CommonFinding>();
        for (var entry : groups.entrySet()) {
            var key = entry.getKey();
            var representative = entry.getValue();
            long affected = 0, evaluated = 0;
            boolean evidence = false;
            var examples = new ArrayList<PageResult>();
            var sources = new TreeSet<String>();
            var exclusions = new TreeMap<String, Long>();
            for (var page : pages) {
                var rules =
                        page.diagnostic().rules().stream()
                                .filter(r -> r.key().equals(key.rule()))
                                .toList();
                var matches =
                        rules.stream()
                                .filter(r -> r.definitionVersion().equals(key.definition()))
                                .distinct()
                                .toList();
                var r = matches.size() == 1 ? matches.getFirst() : null;
                if (r != null && Set.of("PASS", "FAIL").contains(r.outcome())) {
                    evaluated++;
                    if (r.outcome().equals("FAIL")) {
                        affected++;
                        examples.add(page.result());
                        sources.addAll(r.provenance());
                        evidence |= r.evidenceAvailable();
                    }
                } else {
                    String reason =
                            r != null
                                    ? DiagnosticProjection.code(r.reason(), r.outcome())
                                    : matches.size() > 1
                                            ? "AMBIGUOUS_DEFINITION"
                                            : !rules.isEmpty()
                                                    ? "INCOMPATIBLE_DEFINITION"
                                                    : !page.result().reportAvailable()
                                                            ? page.result().executionStatus()
                                                                            == ExecutionStatus
                                                                                    .FAILED
                                                                    ? "ANALYSIS_FAILED"
                                                                    : "REPORT_UNAVAILABLE"
                                                            : "RULE_NOT_MEASURED";
                    exclusions.merge(reason, 1L, Long::sum);
                }
            }
            if (affected < 2) continue;
            examples.sort(PRIORITY);
            result.add(
                    new CommonFinding(
                            key.rule(),
                            key.definition(),
                            Category.valueOf(representative.category()),
                            sources.stream().limit(16).toList(),
                            Severity.valueOf(representative.severity()),
                            key.rule(),
                            affected,
                            evaluated,
                            (long) pages.size(),
                            examples.stream().limit(5).map(PageResult::pageId).toList(),
                            evidence,
                            representative.title(),
                            representative.impact(),
                            representative.recommendation(),
                            pages.size() - evaluated,
                            exclusions.entrySet().stream()
                                    .map(e -> new FindingExclusion(e.getKey(), e.getValue()))
                                    .toList()));
        }
        result.sort(
                Comparator.comparing(CommonFinding::affectedPages)
                        .reversed()
                        .thenComparingInt(f -> DiagnosticProjection.rank(f.severity().name()))
                        .thenComparing(CommonFinding::ruleKey)
                        .thenComparing(CommonFinding::definitionVersion));
        return List.copyOf(result);
    }

    public record Filter(
            String ruleKey,
            String definitionVersion,
            String severity,
            String status,
            String query,
            String sort,
            String scope,
            String completeness) {
        public Filter {
            if (ruleKey != null
                            && (ruleKey.isBlank()
                                    || ruleKey.length() > 200
                                    || ruleKey.chars().anyMatch(Character::isISOControl))
                    || definitionVersion != null
                            && (!definitionVersion.matches("[a-f0-9]{64}") || ruleKey == null)
                    || query != null
                            && (query.length() > 2048
                                    || query.chars().anyMatch(Character::isISOControl)))
                throw invalid();
            if (severity != null && !Set.of("CRITICAL", "IMPORTANT", "INFO").contains(severity)
                    || status != null
                            && !Set.of("QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED")
                                    .contains(status)
                    || completeness != null
                            && !Set.of("FULL", "PARTIAL", "NONE", "UNKNOWN").contains(completeness))
                throw invalid();
            sort = sort == null ? "priority" : sort;
            scope = scope == null ? "all" : scope;
            if (!Set.of("priority", "url").contains(sort)
                    || !Set.of("all", "problematic", "incomplete").contains(scope)) throw invalid();
        }

        public boolean matches(Page page) {
            var p = page.result();
            return (status == null || status.equals(p.executionStatus().name()))
                    && (completeness == null || completeness.equals(p.completeness().name()))
                    && (query == null
                            || p.normalizedUrl()
                                    .toLowerCase(Locale.ROOT)
                                    .contains(query.toLowerCase(Locale.ROOT)))
                    && (!scope.equals("problematic") || priority(p))
                    && (!scope.equals("incomplete") || incomplete(p))
                    && ((ruleKey == null && severity == null)
                            || page.diagnostic().rules().stream()
                                    .anyMatch(
                                            r ->
                                                    r.outcome().equals("FAIL")
                                                            && (ruleKey == null
                                                                    || r.key().equals(ruleKey))
                                                            && (definitionVersion == null
                                                                    || r.definitionVersion()
                                                                            .equals(
                                                                                    definitionVersion))
                                                            && (severity == null
                                                                    || r.severity()
                                                                            .equals(severity))));
        }

        private static AccountError invalid() {
            return new AccountError(400, "filter_invalid");
        }
    }
}
