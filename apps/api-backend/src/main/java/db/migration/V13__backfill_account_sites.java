package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.*;

/** Bounded, restartable data migration; V12 contains only the schema DDL. */
public class V13__backfill_account_sites extends BaseJavaMigration {
    @Override public boolean canExecuteInTransaction() { return false; }
    @Override public void migrate(Context context) throws Exception {
        var c=context.getConnection();
        long after=0,end;
        while((end=endOfBatch(c,"ARG_AUDIT_RUN",after))>after) {
            try(var s=c.prepareStatement("""
                INSERT INTO ARG_ACCOUNT_SITE(id,owner_user_id,domain_id,created_at)
                SELECT MIN(r.id),r.owner_user_id,a.domain_id,MIN(r.created_at)
                FROM ARG_AUDIT_RUN r JOIN ARG_AUDIT a ON a.id=r.audit_id
                WHERE r.id>? AND r.id<=? AND r.owner_user_id IS NOT NULL AND a.domain_id IS NOT NULL
                GROUP BY r.owner_user_id,a.domain_id
                ON DUPLICATE KEY UPDATE created_at=LEAST(created_at,VALUES(created_at))
                """)) { s.setLong(1,after);s.setLong(2,end);s.executeUpdate(); }
            try(var s=c.prepareStatement("""
                INSERT INTO ARG_ACCOUNT_SITE_URL(id,site_id,audit_id,created_at)
                SELECT MIN(r.id),s.id,a.id,MIN(r.created_at)
                FROM ARG_AUDIT_RUN r JOIN ARG_AUDIT a ON a.id=r.audit_id
                JOIN ARG_ACCOUNT_SITE s ON s.owner_user_id=r.owner_user_id AND s.domain_id=a.domain_id
                WHERE r.id>? AND r.id<=?
                GROUP BY s.id,a.id
                ON DUPLICATE KEY UPDATE created_at=LEAST(created_at,VALUES(created_at))
                """)) { s.setLong(1,after);s.setLong(2,end);s.executeUpdate(); }
            after=end;
        }
        after=0;
        while((end=endOfBatch(c,"ARG_AUDIT_REPORT",after))>after) {
            try(var s=c.prepareStatement("""
                UPDATE ARG_AUDIT_REPORT SET provisional=CASE JSON_VALUE(report_json,'$.scores.coverage.provisional')
                WHEN 'true' THEN 1 WHEN '1' THEN 1 WHEN 'false' THEN 0 WHEN '0' THEN 0 ELSE NULL END
                WHERE id>? AND id<=?
                """)) { s.setLong(1,after);s.setLong(2,end);s.executeUpdate(); }
            after=end;
        }
    }
    private long endOfBatch(Connection c,String table,long after) throws SQLException {
        // Table names are internal constants, never request inputs.
        try(var s=c.prepareStatement("SELECT id FROM "+table+" WHERE id>? ORDER BY id LIMIT 1000")) {
            s.setLong(1,after);long end=after;
            try(var r=s.executeQuery()) {while(r.next()) end=r.getLong(1);}
            return end;
        }
    }
}
