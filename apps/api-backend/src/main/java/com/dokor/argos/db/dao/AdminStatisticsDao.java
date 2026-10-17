package com.dokor.argos.db.dao;

import jakarta.inject.Singleton;
import java.sql.*;
import java.time.Instant;

/** Bounded aggregate projections only: never reads URLs, report payloads or account identities into Java. */
@Singleton
public class AdminStatisticsDao {
    public record Accounts(long created, long validated, long suspended, long archived,
                           long validationUnknown, long google, long github, long linkedin) {}
    public record Analyses(long total, long queued, long running, long completed, long failed,
                           long canceled, long unknown) {}
    public record Domains(long total, double averageUrls) {}
    public record Snapshot(Accounts accounts, Analyses analyses, Domains domains) {}

    public Snapshot read(Connection c, Instant from, Instant until) {
        // Validation is the actual account state, including the saved pre-suspension state.
        // Archival does not retain the previous validation state reliably.
        String accountsSql = """
            SELECT COUNT(*) created,
              COUNT(CASE WHEN state='ACTIVE' OR (state='SUSPENDED' AND suspended_from='ACTIVE') THEN 1 END) validated,
              COUNT(CASE WHEN state='SUSPENDED' THEN 1 END) suspended,
              COUNT(CASE WHEN state='ARCHIVED' THEN 1 END) archived,
              COUNT(CASE WHEN state='ARCHIVED' OR (state='SUSPENDED' AND suspended_from IS NULL) THEN 1 END) validation_unknown
            FROM ARG_ACCOUNT_USER WHERE created_at<=?
            """ + (from == null ? "" : " AND created_at>=?");
        String providersSql = """
            SELECT i.provider,COUNT(DISTINCT i.user_id) linked
            FROM ARG_ACCOUNT_IDENTITY i JOIN ARG_ACCOUNT_USER u ON u.id=i.user_id
            WHERE i.provider IN ('google','github','linkedin') AND i.disabled_at IS NULL
              AND u.created_at<=?
            """ + (from == null ? "" : " AND u.created_at>=?") + " GROUP BY i.provider";
        // ARG_AUDIT is the persisted unique normalized-URL identity shared by all owners/reruns.
        // Index probes find the first and last attempt per URL, without scanning result_json.
        String urlsSql = """
            SELECT COUNT(*) total,
              COUNT(CASE WHEN r.status='QUEUED' THEN 1 END) queued,
              COUNT(CASE WHEN r.status='RUNNING' THEN 1 END) running,
              COUNT(CASE WHEN r.status='COMPLETED' THEN 1 END) completed,
              COUNT(CASE WHEN r.status='FAILED' THEN 1 END) failed,
              COUNT(CASE WHEN r.status='CANCELED' THEN 1 END) canceled,
              COUNT(CASE WHEN r.status IS NULL OR r.status NOT IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELED') THEN 1 END) unknown,
              COUNT(DISTINCT a.domain_id) domains
            FROM ARG_AUDIT a
            JOIN ARG_AUDIT_RUN r ON r.id=(SELECT x.id FROM ARG_AUDIT_RUN x
              WHERE x.audit_id=a.id AND x.created_at<=? ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
            """ + (from == null ? "" : """
            WHERE (SELECT x.created_at FROM ARG_AUDIT_RUN x WHERE x.audit_id=a.id
              ORDER BY x.created_at,x.id LIMIT 1)>=?
            """);
        try {
            long created, validated, suspended, archived, unknownValidation;
            try (var s = prepare(c, accountsSql, from, until); var r = s.executeQuery()) {
                r.next();
                created=r.getLong("created"); validated=r.getLong("validated");
                suspended=r.getLong("suspended"); archived=r.getLong("archived");
                unknownValidation=r.getLong("validation_unknown");
            }
            long google=0, github=0, linkedin=0;
            try (var s = prepare(c, providersSql, from, until); var r = s.executeQuery()) {
                while (r.next()) {
                    switch (r.getString("provider")) {
                        case "google" -> google=r.getLong("linked");
                        case "github" -> github=r.getLong("linked");
                        case "linkedin" -> linkedin=r.getLong("linked");
                        default -> throw new IllegalStateException("Unexpected provider aggregate");
                    }
                }
            }
            try (var s = prepare(c, urlsSql, from, until); var r = s.executeQuery()) {
                r.next();
                long total=r.getLong("total"), domains=r.getLong("domains");
                return new Snapshot(new Accounts(created,validated,suspended,archived,unknownValidation,google,github,linkedin),
                    new Analyses(total,r.getLong("queued"),r.getLong("running"),r.getLong("completed"),
                        r.getLong("failed"),r.getLong("canceled"),r.getLong("unknown")),
                    new Domains(domains,domains==0 ? 0 : (double)total/domains));
            }
        } catch (SQLException e) { throw new IllegalStateException("Administration statistics query failed",e); }
    }

    private static PreparedStatement prepare(Connection c, String sql, Instant from, Instant until) throws SQLException {
        var s=c.prepareStatement(sql);
        try {
            s.setQueryTimeout(15);
            s.setTimestamp(1,Timestamp.from(until));
            if (from!=null) s.setTimestamp(2,Timestamp.from(from));
            return s;
        } catch (SQLException e) { s.close(); throw e; }
    }
}
