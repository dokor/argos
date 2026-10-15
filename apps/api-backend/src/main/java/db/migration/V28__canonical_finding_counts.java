package db.migration;

import com.dokor.argos.services.connected.summary.DiagnosticProjection;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.*;
import java.util.*;

/** Restartable pages of frozen reports. Updates counters and domain rules together, without rescoring. */
public class V28__canonical_finding_counts extends BaseJavaMigration {
    @Override public boolean canExecuteInTransaction() { return false; }
    @Override public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        var mapper = new ObjectMapper();
        long after = 0;
        record Row(long id, String report, String diagnostic) {}
        while (true) {
            var rows = new ArrayList<Row>();
            try (var query = connection.prepareStatement("SELECT id,report_json,diagnostic_json FROM ARG_AUDIT_REPORT WHERE id>? AND (diagnostic_json IS NULL OR NOT JSON_VALID(diagnostic_json) OR COALESCE(JSON_VALUE(diagnostic_json,'$.version'),0)<>2) ORDER BY id LIMIT 20")) {
                query.setLong(1, after);
                try (var result = query.executeQuery()) {
                    while (result.next()) rows.add(new Row(result.getLong(1), result.getString(2), result.getString(3)));
                }
            }
            if (rows.isEmpty()) break;
            try (var update = connection.prepareStatement("UPDATE ARG_AUDIT_REPORT SET diagnostic_json=?,critical_count=?,important_count=? WHERE id=?")) {
                for (var row : rows) {
                    DiagnosticProjection original = DiagnosticProjection.unknown(), projection;
                    try {
                        if (row.diagnostic() != null) original = mapper.readValue(row.diagnostic(), DiagnosticProjection.class);
                        if (original == null || original.rules() == null) original = DiagnosticProjection.unknown();
                    } catch (Exception malformed) { original = DiagnosticProjection.unknown(); }
                    try { projection = DiagnosticProjection.canonical(mapper.readTree(row.report()), original); }
                    catch (Exception malformed) { projection = DiagnosticProjection.unknown(); }
                    update.setString(1, mapper.writeValueAsString(projection));
                    update.setObject(2, projection.criticalCount()); update.setObject(3, projection.importantCount());
                    update.setLong(4, row.id()); update.addBatch(); after = row.id();
                }
                update.executeBatch();
            }
        }
    }
}
