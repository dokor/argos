package com.dokor.argos.services.domain.report;
import com.dokor.argos.db.generated.AuditReport;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
class ReportRetentionPolicyTest {
    private final ReportRetentionPolicy policy=ReportRetentionPolicy.defaults();
    @Test void leapDayUsesCalendarYearsInUtc() {
        assertEquals(Instant.parse("2027-02-28T12:00:00Z"), policy.expiresAt(Instant.parse("2024-02-29T12:00:00Z")));
    }
    @Test void historicalReportWithoutExpiryExpiresAtBoundary() {
        var report=new AuditReport(); report.setCreatedAt(Instant.parse("2023-10-11T00:00:00Z"));
        assertFalse(policy.expired(report, Instant.parse("2026-10-10T23:59:59Z")));
        assertTrue(policy.expired(report, Instant.parse("2026-10-11T00:00:00Z")));
    }
    @Test void earlierExpiryWinsAndLaterExpiryCannotExtendDefault() {
        var report=new AuditReport(); report.setCreatedAt(Instant.parse("2023-01-01T00:00:00Z"));
        report.setExpiresAt(Instant.parse("2024-01-01T00:00:00Z")); assertTrue(policy.expired(report, Instant.parse("2024-01-01T00:00:00Z")));
        report.setExpiresAt(Instant.parse("2028-01-01T00:00:00Z")); assertTrue(policy.expired(report, Instant.parse("2026-01-01T00:00:00Z")));
    }
    @Test void invalidDurationFailsConfiguration() {
        assertThrows(IllegalArgumentException.class,()->new ReportRetentionPolicy(ConfigFactory.parseString("report.retention-years=0")));
        assertThrows(IllegalArgumentException.class,()->new ReportRetentionPolicy(ConfigFactory.parseString("report.retention-years=11")));
    }
}
