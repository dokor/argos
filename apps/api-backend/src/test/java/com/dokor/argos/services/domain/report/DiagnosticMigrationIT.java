package com.dokor.argos.services.domain.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dokor.argos.services.connected.summary.*;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;

class DiagnosticMigrationIT extends MariaDbReportFixture {
    @Test
    void backfillFrozenEvidenceUnknownLegacyAndRestart() throws Exception {
        migrateHistoricalRowsTo("23");
        var fixture = SummaryFixture.fixture();
        var e =
                SummaryFixture.evidence(
                        fixture, fixture.path("domains").get(0).path("pages").get(0));
        try (var c = source.getConnection();
                var report =
                        c.prepareStatement("UPDATE ARG_AUDIT_REPORT SET report_json=? WHERE id=1");
                var run = c.prepareStatement("UPDATE ARG_AUDIT_RUN SET result_json=? WHERE id=1")) {
            report.setString(1, e.report().toString());
            report.executeUpdate();
            run.setString(1, "{\"score\":" + e.score() + "}");
            run.executeUpdate();
        }
        // A DDL interruption may leave only one new column; migration remains restartable.
        sql("ALTER TABLE ARG_AUDIT_REPORT ADD COLUMN diagnostic_json LONGTEXT NULL");
        Flyway.configure().dataSource(source).target("26").load().migrate();
        try (var c = source.getConnection();
                var s = c.createStatement();
                var r =
                        s.executeQuery(
                                "SELECT id,diagnostic_json,critical_count,important_count FROM"
                                    + " ARG_AUDIT_REPORT ORDER BY id")) {
            assertTrue(r.next());
            assertEquals(1, r.getLong(1));
            assertEquals(
                    DiagnosticProjection.from(e.report(), e.score()),
                    mapper.readValue(r.getString(2), DiagnosticProjection.class));
            assertEquals(0, r.getInt(3));
            assertEquals(1, r.getInt(4));
            assertTrue(r.next());
            assertEquals(
                    DiagnosticProjection.unknown(),
                    mapper.readValue(r.getString(2), DiagnosticProjection.class));
            assertNull(r.getObject(3));
        }
        sql("UPDATE ARG_AUDIT_RUN SET result_json=NULL WHERE id=1");
        try (var c = source.getConnection()) {
            var context = mock(Context.class);
            when(context.getConnection()).thenReturn(c);
            new db.migration.V24__report_diagnostics().migrate(context);
        }
        try (var c = source.getConnection();
                var s = c.createStatement();
                var r = s.executeQuery("SELECT important_count FROM ARG_AUDIT_REPORT WHERE id=1")) {
            assertTrue(r.next());
            assertEquals(1, r.getInt(1));
        }
    }
}
