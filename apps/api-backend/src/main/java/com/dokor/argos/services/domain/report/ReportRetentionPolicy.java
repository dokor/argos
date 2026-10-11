package com.dokor.argos.services.domain.report;
import com.dokor.argos.db.generated.AuditReport;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.Instant;
import java.time.ZoneOffset;
@Singleton
public class ReportRetentionPolicy {
    private final int years;
    @Inject public ReportRetentionPolicy(Config config) {
        years=config.hasPath("report.retention-years") ? config.getInt("report.retention-years") : 3;
        if(years<1 || years>10) throw new IllegalArgumentException("report.retention-years must be between 1 and 10");
    }
    public static ReportRetentionPolicy defaults() { return new ReportRetentionPolicy(ConfigFactory.empty()); }
    public Instant expiresAt(Instant createdAt) { return createdAt.atZone(ZoneOffset.UTC).plusYears(years).toInstant(); }
    public boolean expired(AuditReport report, Instant now) {
        if(report.getExpiresAt()!=null && !report.getExpiresAt().isAfter(now)) return true;
        return report.getCreatedAt()!=null && !expiresAt(report.getCreatedAt()).isAfter(now);
    }
}
