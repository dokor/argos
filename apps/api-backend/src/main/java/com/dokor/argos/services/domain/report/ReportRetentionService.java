package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.AuditReport;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Limited retention: only expired published reports and their terminal run payloads. */
@Singleton
public class ReportRetentionService {
    private static final Logger LOG = LoggerFactory.getLogger(ReportRetentionService.class);
    private static final int BATCH_SIZE = 500;
    private final TransactionManagerQuerydsl transactions;
    private final ReportRetentionPolicy policy;

    @Inject
    public ReportRetentionService(TransactionManagerQuerydsl transactions, ReportRetentionPolicy policy) {
        this.transactions = transactions;
        this.policy = policy;
    }

    private static Calendar utc() {
        return Calendar.getInstance(TimeZone.getTimeZone("UTC"));
    }

    public void purgeExpiredReports() {
        try {
            int removed = purge(Instant.now());
            if (removed > 0) LOG.info("Expired report retention removed {} report(s)", removed);
        } catch (RuntimeException unavailable) {
            LOG.warn("Expired report retention deferred: {}", unavailable.getClass().getSimpleName());
        }
    }

    /** One bounded atomic batch; row locks protect terminal state and publication. */
    public int purge(Instant now) {
        return transactions.executeAndReturn(connection -> {
            record Candidate(long reportId, long runId) {}
            var candidates = new ArrayList<Candidate>();
            String select = "SELECT p.id,p.run_id,p.created_at,p.expires_at "
                + "FROM ARG_AUDIT_REPORT p JOIN ARG_AUDIT_RUN r ON r.id=p.run_id "
                + "WHERE r.status IN ('COMPLETED','FAILED') "
                + "AND (p.expires_at <= ? OR DATE_ADD(p.created_at, INTERVAL ? YEAR) <= ?) "
                + "ORDER BY p.created_at,p.id LIMIT " + BATCH_SIZE + " FOR UPDATE";
            try (var query = connection.prepareStatement(select)) {
                query.setTimestamp(1, Timestamp.from(now), utc());
                query.setInt(2, policy.retentionYears());
                query.setTimestamp(3, Timestamp.from(now), utc());
                try (var result = query.executeQuery()) {
                    while (result.next()) {
                        var report = new AuditReport();
                        report.setCreatedAt(result.getTimestamp(3, utc()).toInstant());
                        var explicit = result.getTimestamp(4, utc());
                        report.setExpiresAt(explicit == null ? null : explicit.toInstant());
                        if (policy.expired(report, now)) candidates.add(new Candidate(result.getLong(1), result.getLong(2)));
                    }
                }
                // Preserve run IDs, audit/domain metadata, states, dates and attempts.
                // Revoke progress credentials as well as deleting the published report.
                try (var clear = connection.prepareStatement("UPDATE ARG_AUDIT_RUN SET result_json=NULL,module_statuses=NULL,last_error=NULL,claim_token=NULL,report_token_hash=NULL WHERE id=? AND status IN ('COMPLETED','FAILED')");
                     var delete = connection.prepareStatement("DELETE FROM ARG_AUDIT_REPORT WHERE id=? AND run_id=?")) {
                    for (var candidate : candidates) {
                        clear.setLong(1, candidate.runId());
                        if (clear.executeUpdate() != 1) throw new IllegalStateException("Retention terminal run changed");
                        delete.setLong(1, candidate.reportId());
                        delete.setLong(2, candidate.runId());
                        if (delete.executeUpdate() != 1) throw new IllegalStateException("Retention report changed");
                    }
                }
                return candidates.size();
            } catch (SQLException unavailable) {
                // No SQL arguments, credentials or report contents in scheduler logs.
                throw new IllegalStateException("Report retention transaction failed");
            }
        });
    }
}
