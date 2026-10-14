package db.migration;

import com.dokor.argos.services.domain.report.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.flywaydb.core.api.migration.*;

import java.util.*;

/** Bounded, restartable materialization of the existing completeness rule, never new scoring. */
public class V25__report_completeness extends BaseJavaMigration {
    @Override
    public boolean canExecuteInTransaction() {
        return false;
    }

    @Override
    public void migrate(Context context) throws Exception {
        var c = context.getConnection();
        try (var s = c.createStatement()) {
            s.execute(
                    "ALTER TABLE ARG_AUDIT_REPORT ADD COLUMN IF NOT EXISTS measurement_completeness"
                        + " VARCHAR(16) NULL");
        }
        var mapper = new ObjectMapper().findAndRegisterModules();
        long after = 0;
        record Row(long id, String report) {}
        while (true) {
            var rows = new ArrayList<Row>();
            try (var s =
                    c.prepareStatement(
                            "SELECT id,report_json FROM ARG_AUDIT_REPORT WHERE id>? AND"
                                + " measurement_completeness IS NULL ORDER BY id LIMIT 20")) {
                s.setLong(1, after);
                try (var r = s.executeQuery()) {
                    while (r.next()) rows.add(new Row(r.getLong(1), r.getString(2)));
                }
            }
            if (rows.isEmpty()) break;
            try (var s =
                    c.prepareStatement(
                            "UPDATE ARG_AUDIT_REPORT SET measurement_completeness=? WHERE id=? AND"
                                + " measurement_completeness IS NULL")) {
                for (var row : rows) {
                    String value = "UNKNOWN";
                    try {
                        value =
                                ReportCompleteness.from(
                                        mapper.readValue(row.report(), ReportDto.class));
                    } catch (com.fasterxml.jackson.core.JsonProcessingException
                            | IllegalArgumentException ignored) {
                    }
                    s.setString(1, value);
                    s.setLong(2, row.id());
                    s.addBatch();
                    after = row.id();
                }
                s.executeBatch();
            }
        }
    }
}
