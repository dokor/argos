package com.dokor.argos.services.account;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Bounded, owner-scoped projections of finalized ledger entries. Never reads reports or batches. */
@Singleton
public final class UsageTimelineService {
    public enum Granularity { DAY, MONTH, YEAR }
    public enum Dimension { GLOBAL, DOMAIN, URL }
    public record Bucket(String from, String until, long total, Map<String, Long> values) {}
    public record Series(String key, String label, long total) {}
    public record Timeline(String timezone, String snapshotAt, String coverageFrom, long undatedCredits,
            Granularity granularity, Dimension dimension, long total, List<Series> series,
            List<Bucket> buckets, List<Series> options, boolean moreOptions) {}
    public record Range(Granularity granularity, Dimension dimension, List<LocalDate> boundaries, List<String> filters, String search) {}

    private final AccountSessionService sessions;
    private final UsagePolicy policy;
    private final Clock clock;

    @Inject public UsageTimelineService(AccountSessionService sessions, UsagePolicy policy, Clock clock) {
        this.sessions = sessions;
        this.policy = policy;
        this.clock = clock;
    }

    public Timeline timeline(String auth, String granularity, String dimension, String from, String until,
            List<String> filters, String search) {
        Range range = range(granularity, dimension, from, until, filters, search);
        return sessions.with(auth, null, true, false, (context, connection) -> read(context.user().getId(), range, connection));
    }

    Range range(String granularity, String dimension, String from, String until, List<String> filters, String search) {
        try {
            var unit = Granularity.valueOf(granularity);
            var group = Dimension.valueOf(dimension);
            LocalDate start = LocalDate.parse(from), end = LocalDate.parse(until);
            if (!start.toString().equals(from) || !end.toString().equals(until) || start.getYear() < 1970 || !start.isBefore(end)) throw new IllegalArgumentException();
            var step = switch (unit) { case DAY -> ChronoUnit.DAYS; case MONTH -> ChronoUnit.MONTHS; case YEAR -> ChronoUnit.YEARS; };
            LocalDate today = LocalDate.now(clock.withZone(policy.zone()));
            LocalDate current = switch (unit) { case DAY -> today; case MONTH -> today.withDayOfMonth(1); case YEAR -> today.withDayOfYear(1); };
            if (end.isAfter(current.plus(1, step))) throw new IllegalArgumentException();
            if (unit != Granularity.DAY && (start.getDayOfMonth() != 1 || end.getDayOfMonth() != 1)) throw new IllegalArgumentException();
            if (unit == Granularity.YEAR && (start.getMonthValue() != 1 || end.getMonthValue() != 1)) throw new IllegalArgumentException();
            long count = step.between(start, end);
            int maximum = switch (unit) { case DAY -> 366; case MONTH -> 60; case YEAR -> 20; };
            if (count < 1 || count > maximum || filters == null || filters.size() > 20 || new HashSet<>(filters).size() != filters.size()) throw new IllegalArgumentException();
            for (String filter : filters) {
                if (!"unknown".equals(filter) && (!filter.matches("[1-9][0-9]{0,18}") || Long.parseLong(filter) <= 0)) throw new IllegalArgumentException();
            }
            if (group == Dimension.GLOBAL && (!filters.isEmpty() || search != null && !search.isBlank())) throw new IllegalArgumentException();
            if (search != null && (search.length() > 200 || search.chars().anyMatch(Character::isISOControl))) throw new IllegalArgumentException();
            var boundaries = new ArrayList<LocalDate>();
            for (int i = 0; i <= count; i++) boundaries.add(start.plus(i, step));
            return new Range(unit, group, List.copyOf(boundaries), List.copyOf(filters), search == null ? "" : search.strip());
        } catch (RuntimeException invalid) {
            throw new AccountError(400, "filter_invalid");
        }
    }

    // LEFT JOIN preserves the accounting total even if a historical target is unavailable.
    private static final String SOURCE = " FROM ARG_USAGE_RUN u LEFT JOIN ARG_AUDIT_RUN r ON r.id=u.id AND r.owner_user_id=u.user_id AND r.ci_navigation_origins IS NULL"
            + " LEFT JOIN ARG_AUDIT a ON a.id=r.audit_id LEFT JOIN ARG_DOMAIN d ON d.id=a.domain_id";
    private static final String SCOPE = " WHERE u.user_id=? AND u.state='COUNTED' AND u.counted_at>=? AND u.counted_at<?";

    private Timeline read(long owner, Range range, Connection connection) {
        String identity = switch (range.dimension()) {
            case GLOBAL -> "'total'";
            case DOMAIN -> "COALESCE(CAST(d.id AS CHAR),'unknown')";
            case URL -> "COALESCE(CAST(a.id AS CHAR),'unknown')";
        };
        String label = switch (range.dimension()) { case GLOBAL -> "'total'"; case DOMAIN -> "d.hostname"; case URL -> "a.normalized_url"; };
        var scopeValues = new ArrayList<Object>();
        scopeValues.add(owner);
        scopeValues.add(timestamp(range.boundaries().getFirst()));
        scopeValues.add(timestamp(range.boundaries().getLast()));
        String filteredScope = SCOPE;
        var filteredValues = new ArrayList<>(scopeValues);
        if (!range.filters().isEmpty()) {
            filteredScope += " AND " + identity + " IN (" + placeholders(range.filters().size()) + ")";
            filteredValues.addAll(range.filters());
        }
        try {
            String coverage = null;
            // V27 deliberately erased earlier usage; V14 was the initial ledger backfill.
            try (var statement = connection.prepareStatement("SELECT installed_on FROM flyway_schema_history WHERE success=1 AND version IN ('14','27') ORDER BY installed_rank DESC LIMIT 1"); var rows = statement.executeQuery()) {
                if (rows.next()) coverage = rows.getTimestamp(1).toInstant().toString();
            }
            long undated;
            try (var statement = prepare(connection, "SELECT COUNT(*) FROM ARG_USAGE_RUN WHERE user_id=? AND state='COUNTED' AND counted_at IS NULL", List.of(owner)); var rows = statement.executeQuery()) {
                rows.next(); undated = rows.getLong(1);
            }
            List<Series> options = List.of();
            boolean moreOptions = false;
            String grouped = "SELECT " + identity + " AS category,MAX(" + label + ") AS label,COUNT(*) AS credits" + SOURCE;
            if (range.dimension() != Dimension.GLOBAL) {
                var optionValues = new ArrayList<>(scopeValues);
                String search = "";
                if (!range.search().isEmpty()) {
                    search = " AND LOCATE(LOWER(?),LOWER(" + label + "))>0";
                    optionValues.add(range.search());
                }
                var candidates = categories(connection, grouped + SCOPE + search + " GROUP BY category ORDER BY credits DESC,category LIMIT 21", optionValues);
                moreOptions = candidates.size() > 20;
                options = List.copyOf(candidates.subList(0, Math.min(20, candidates.size())));
            }
            var top = categories(connection, grouped + filteredScope + " GROUP BY category ORDER BY credits DESC,category LIMIT 5", filteredValues);
            var queryValues = new ArrayList<Object>();
            var bucketCase = new StringBuilder("CASE ");
            for (int i = 1; i < range.boundaries().size(); i++) {
                bucketCase.append("WHEN u.counted_at<? THEN ").append(i - 1).append(' ');
                queryValues.add(timestamp(range.boundaries().get(i)));
            }
            bucketCase.append("END");
            String category = "'other'";
            if (!top.isEmpty()) {
                category = "CASE WHEN " + identity + " IN (" + placeholders(top.size()) + ") THEN " + identity + " ELSE 'other' END";
                top.forEach(series -> queryValues.add(series.key()));
            }
            queryValues.addAll(filteredValues);
            var values = new ArrayList<Map<String, Long>>();
            for (int i = 1; i < range.boundaries().size(); i++) values.add(new LinkedHashMap<>());
            var totals = new LinkedHashMap<String, Long>();
            try (var statement = prepare(connection, "SELECT " + bucketCase + " AS bucket," + category + " AS category,COUNT(*)" + SOURCE + filteredScope + " GROUP BY bucket,category", queryValues); var rows = statement.executeQuery()) {
                while (rows.next()) {
                    String key = rows.getString(2); long count = rows.getLong(3);
                    values.get(rows.getInt(1)).put(key, count);
                    totals.merge(key, count, Long::sum);
                }
            }
            var series = new ArrayList<Series>();
            // Use the bucket aggregation for every returned total, including under concurrent publication.
            top.forEach(item -> series.add(new Series(item.key(), item.label(), totals.getOrDefault(item.key(), 0L))));
            if (totals.containsKey("other")) series.add(new Series("other", "other", totals.get("other")));
            var buckets = new ArrayList<Bucket>();
            for (int i = 0; i < values.size(); i++) {
                var counts = values.get(i);
                buckets.add(new Bucket(range.boundaries().get(i).toString(), range.boundaries().get(i + 1).toString(), counts.values().stream().mapToLong(Long::longValue).sum(), Map.copyOf(counts)));
            }
            return new Timeline(policy.zone().getId(), clock.instant().toString(), coverage, undated, range.granularity(), range.dimension(),
                    totals.values().stream().mapToLong(Long::longValue).sum(), List.copyOf(series), List.copyOf(buckets), options, moreOptions);
        } catch (SQLException failure) {
            throw new IllegalStateException("Usage timeline unavailable", failure);
        }
    }

    private Timestamp timestamp(LocalDate date) { return Timestamp.from(date.atStartOfDay(policy.zone()).toInstant()); }
    private static String placeholders(int count) { return String.join(",", Collections.nCopies(count, "?")); }
    private static PreparedStatement prepare(Connection connection, String sql, List<Object> values) throws SQLException {
        var statement = connection.prepareStatement(sql);
        try {
            statement.setQueryTimeout(10);
            for (int i = 0; i < values.size(); i++) statement.setObject(i + 1, values.get(i));
            return statement;
        } catch (SQLException failure) { statement.close(); throw failure; }
    }
    private static List<Series> categories(Connection connection, String sql, List<Object> values) throws SQLException {
        var result = new ArrayList<Series>();
        try (var statement = prepare(connection, sql, values); var rows = statement.executeQuery()) {
            while (rows.next()) result.add(new Series(rows.getString(1), rows.getString(2), rows.getLong(3)));
        }
        return result;
    }
}
