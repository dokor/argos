package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.services.analysis.scoring.MeasurementCoverageService;
import com.dokor.argos.services.analysis.scoring.ScorePolicy;
import com.dokor.argos.services.domain.report.ReportRetentionPolicy;
import com.dokor.argos.services.statistics.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@Singleton
public class ProblemStatisticsDao {
    public static final int MINIMUM_GROUP_SIZE = 10;
    private final TransactionManagerQuerydsl transactions;

    @Inject public ProblemStatisticsDao(TransactionManagerQuerydsl transactions) { this.transactions = transactions; }
    private static Calendar utc() { return Calendar.getInstance(TimeZone.getTimeZone("UTC")); }

    /** Shares the publication transaction. FK cascade shares the report's retention. */
    public void write(long reportId, ProblemProjection projection, Connection connection) {
        try (var update = connection.prepareStatement("UPDATE ARG_AUDIT_REPORT SET problem_projection_version=?,problem_fingerprint=?,problem_coverage_version=?,problem_partial=? WHERE id=?");
             var insert = connection.prepareStatement("INSERT INTO ARG_REPORT_PROBLEM_CHECK(report_id,check_key,category,severity) VALUES(?,?,?,?)")) {
            update.setInt(1, ProblemProjection.VERSION);
            update.setString(2, projection.fingerprint());
            update.setString(3, projection.coverageVersion());
            update.setObject(4, projection.partial());
            update.setLong(5, reportId);
            if (update.executeUpdate() != 1) throw new IllegalStateException("Problem projection report missing");
            for (var check : projection.checks()) {
                insert.setLong(1, reportId); insert.setString(2, check.key());
                insert.setString(3, check.category()); insert.setString(4, check.severity()); insert.addBatch();
            }
            if (!projection.checks().isEmpty()) insert.executeBatch();
        } catch (SQLException failure) { throw new IllegalStateException("Problem projection write failed", failure); }
    }

    /** At most 25 blobs per scheduled batch, capped at 2 MiB each; never called by a metrics read. */
    public int backfill(Instant from, Instant now, ReportRetentionPolicy retention, ObjectMapper mapper, ScorePolicy policy) {
        return transactions.executeAndReturn(connection -> {
            String sql = "SELECT id,CASE WHEN OCTET_LENGTH(report_json)<=2097152 THEN report_json ELSE NULL END "
                + "FROM ARG_AUDIT_REPORT WHERE problem_projection_version IS NULL AND created_at>=? "
                + "AND (expires_at IS NULL OR expires_at>?) AND DATE_ADD(created_at,INTERVAL ? YEAR)>? "
                + "ORDER BY id LIMIT 25 FOR UPDATE SKIP LOCKED";
            try (var query = connection.prepareStatement(sql)) {
                query.setTimestamp(1, Timestamp.from(from), utc()); query.setTimestamp(2, Timestamp.from(now), utc());
                query.setInt(3, retention.retentionYears()); query.setTimestamp(4, Timestamp.from(now), utc());
                record Row(long id, String json) {}
                var rows = new ArrayList<Row>();
                try (var result = query.executeQuery()) { while (result.next()) rows.add(new Row(result.getLong(1), result.getString(2))); }
                for (var row : rows) {
                    var projection = ProblemProjection.unknown();
                    if (row.json() != null) {
                        try { projection = ProblemProjection.from(mapper.readTree(row.json()), policy); }
                        catch (java.io.IOException invalid) { /* Invalid historical reports stay explicitly excluded. */ }
                    }
                    write(row.id(), projection, connection);
                }
                return rows.size();
            } catch (SQLException failure) { throw new IllegalStateException("Problem projection backfill failed", failure); }
        });
    }

    // Rank before filtering method/coverage: an incompatible latest report must not resurrect an older one.
    static final String COHORT = """
        WITH ranked AS (
            SELECT p.id,p.problem_projection_version,p.problem_fingerprint,p.problem_coverage_version,p.problem_partial,
                ROW_NUMBER() OVER (PARTITION BY a.domain_id ORDER BY p.created_at DESC,p.id DESC) AS position
            FROM ARG_AUDIT_REPORT p JOIN ARG_AUDIT a ON a.id=p.audit_id
            JOIN ARG_AUDIT_RUN r ON r.id=p.run_id AND r.status='COMPLETED'
            WHERE p.created_at>=? AND p.created_at<? AND (p.expires_at IS NULL OR p.expires_at>?)
                AND DATE_ADD(p.created_at,INTERVAL ? YEAR)>?
        ), latest AS (
            SELECT *, (problem_projection_version=1 AND problem_fingerprint=?
                AND problem_coverage_version=? AND problem_partial IS NOT NULL) AS eligible
            FROM ranked WHERE position=1
        )
        """;

    private static void bind(PreparedStatement query, Instant from, Instant until, Instant now,
                             ReportRetentionPolicy retention, ScorePolicy policy) throws SQLException {
        query.setTimestamp(1, Timestamp.from(from), utc()); query.setTimestamp(2, Timestamp.from(until), utc());
        query.setTimestamp(3, Timestamp.from(now), utc()); query.setInt(4, retention.retentionYears());
        query.setTimestamp(5, Timestamp.from(now), utc()); query.setString(6, policy.fingerprint());
        query.setString(7, MeasurementCoverageService.VERSION);
    }

    public ProblemStatistics read(Connection connection, Instant from, Instant until, Instant now,
                                   ReportRetentionPolicy retention, ScorePolicy policy, String category) {
        try (var summary = connection.prepareStatement(COHORT + """
            SELECT (SELECT COUNT(*) FROM ranked),COUNT(*),COALESCE(SUM(eligible),0),
                COALESCE(SUM(eligible AND problem_partial=1),0),
                COALESCE(SUM(problem_projection_version IS NULL),0) FROM latest
            """);
             // Preserve close ranks instead of rounding count division to MariaDB's default DECIMAL scale.
             var findings = connection.prepareStatement(COHORT + """
            SELECT c.check_key,c.category,
                CASE WHEN SUM(c.severity='critical')>0 THEN 'critical'
                     WHEN SUM(c.severity='important')>0 THEN 'important' ELSE 'info' END,
                COUNT(c.severity) AS affected,COUNT(*) AS measured
            FROM latest l JOIN ARG_REPORT_PROBLEM_CHECK c ON c.report_id=l.id
            WHERE l.eligible=1 AND (? IS NULL OR c.category=?)
            GROUP BY c.check_key,c.category
            HAVING COUNT(c.severity)>=10 AND COUNT(*)>=10
            ORDER BY COUNT(c.severity)*1e0/COUNT(*) DESC,COUNT(c.severity) DESC,c.check_key
            """)) {
            bind(summary, from, until, now, retention, policy); bind(findings, from, until, now, retention, policy);
            findings.setString(8, category); findings.setString(9, category);
            long reports, domains, retained, partial, pending;
            try (var result = summary.executeQuery()) {
                result.next(); reports=result.getLong(1); domains=result.getLong(2); retained=result.getLong(3);
                partial=result.getLong(4); pending=result.getLong(5);
            }
            var rows = new ArrayList<ProblemStatistics.Finding>();
            try (var result = findings.executeQuery()) {
                while (result.next()) rows.add(new ProblemStatistics.Finding(result.getString(1), result.getString(2),
                    result.getString(3), result.getLong(4), result.getLong(5), (double)result.getLong(4)/result.getLong(5)));
            }
            return new ProblemStatistics(from, until, now, policy.version(), policy.fingerprint(),
                MeasurementCoverageService.VERSION, MINIMUM_GROUP_SIZE, reports, domains, retained, partial,
                domains-retained, pending, List.copyOf(rows));
        } catch (SQLException failure) { throw new IllegalStateException("Problem statistics read failed", failure); }
    }
}
