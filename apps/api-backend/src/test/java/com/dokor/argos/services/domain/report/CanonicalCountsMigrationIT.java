package com.dokor.argos.services.domain.report;

import com.dokor.argos.services.connected.summary.*;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CanonicalCountsMigrationIT extends MariaDbReportFixture {
    @Test void updatesExistingProjectionsCountersAndRulesAndCanRestartWithoutRawScores() throws Exception {
        var fixture = SummaryFixture.fixture();
        var evidence = SummaryFixture.evidence(fixture, fixture.path("domains").get(0).path("pages").get(0));
        evidence.report().withArray("issues").addObject().put("id", "lighthouse.audit.image-alt")
            .put("module", "lighthouse").put("categoryKey", "a11y").put("severity", "critical");
        var expected = DiagnosticProjection.from(evidence.report(), evidence.score());
        try (var connection = source.getConnection()) {
            try (var update = connection.prepareStatement("UPDATE ARG_AUDIT_REPORT SET report_json=?,diagnostic_json='{\"version\":1,\"rules\":[]}',critical_count=0,important_count=0 WHERE id=1")) {
                update.setString(1, evidence.report().toString()); update.executeUpdate();
            }
            sql("UPDATE ARG_AUDIT_RUN SET result_json=NULL WHERE id=1");
            var context = mock(Context.class); when(context.getConnection()).thenReturn(connection);
            new db.migration.V28__canonical_finding_counts().migrate(context);
            new db.migration.V28__canonical_finding_counts().migrate(context);
            try (var statement = connection.createStatement(); var rows = statement.executeQuery("SELECT diagnostic_json,critical_count,important_count FROM ARG_AUDIT_REPORT WHERE id=1")) {
                assertTrue(rows.next());
                var actual = mapper.readValue(rows.getString(1), DiagnosticProjection.class);
                assertEquals(2, actual.version());
                assertEquals(expected.criticalCount(), rows.getLong(2));
                assertEquals(expected.importantCount(), rows.getLong(3));
                assertTrue(actual.rules().stream().anyMatch(r -> r.key().equals("lighthouse.audit.image-alt")));
            }
        }
    }
}
