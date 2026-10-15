package db.migration;

import com.dokor.argos.services.connected.summary.DiagnosticProjection;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.flywaydb.core.api.migration.*;

import java.util.*;

/** Restartable bounded materialization from frozen data, without re-running current rules. */
public class V24__report_diagnostics extends BaseJavaMigration {
    @Override
    public boolean canExecuteInTransaction() {
        return false;
    }

    @Override
    public void migrate(Context context) throws Exception {
        var c = context.getConnection();
        try (var s = c.createStatement()) {
            s.execute(
                    "ALTER TABLE ARG_AUDIT_REPORT ADD COLUMN IF NOT EXISTS diagnostic_json LONGTEXT"
                        + " NULL, ADD COLUMN IF NOT EXISTS critical_count INT NULL, ADD COLUMN IF"
                        + " NOT EXISTS important_count INT NULL");
        }
        var mapper = new ObjectMapper();
        long after = 0;
        record Row(long id, String report, String score) {}
        while (true) {
            var rows = new ArrayList<Row>();
            try (var s =
                    c.prepareStatement(
                            "SELECT p.id,p.report_json,CASE WHEN JSON_VALID(r.result_json) THEN"
                                + " JSON_EXTRACT(r.result_json,'$.score') ELSE NULL END score FROM"
                                + " ARG_AUDIT_REPORT p JOIN ARG_AUDIT_RUN r ON r.id=p.run_id WHERE"
                                + " p.id>? AND p.diagnostic_json IS NULL ORDER BY p.id LIMIT 20")) {
                s.setLong(1, after);
                try (var r = s.executeQuery()) {
                    while (r.next())
                        rows.add(new Row(r.getLong(1), r.getString(2), r.getString(3)));
                }
            }
            if (rows.isEmpty()) break;
            try (var s =
                    c.prepareStatement(
                            "UPDATE ARG_AUDIT_REPORT SET"
                                + " diagnostic_json=?,critical_count=?,important_count=? WHERE id=?"
                                + " AND diagnostic_json IS NULL")) {
                for (var row : rows) {
                    DiagnosticProjection d;
                    try {
                        d =
                                DiagnosticProjection.from(
                                        mapper.readTree(row.report()),
                                        row.score() == null ? null : mapper.readTree(row.score()));
                    } catch (com.fasterxml.jackson.core.JsonProcessingException malformed) {
                        d = DiagnosticProjection.unknown();
                    }
                    s.setString(1, mapper.writeValueAsString(d));
                    s.setObject(2, d.criticalCount());
                    s.setObject(3, d.importantCount());
                    s.setLong(4, row.id());
                    s.addBatch();
                    after = row.id();
                }
                s.executeBatch();
            }
        }
    }
}
