package com.dokor.argos.services.analytics;
import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.services.token.TokenService;
import com.dokor.argos.webservices.api.audits.AdminReadAccess;
import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.account.AdminService;
import com.dokor.argos.services.account.AccountError;
import com.typesafe.config.Config;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.*;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
@Singleton
public class ProductAnalyticsService {
    private static final Logger LOG=LoggerFactory.getLogger(ProductAnalyticsService.class);
    private final boolean enabled;private final ProductAnalyticsDao dao;private final AdminReadAccess access;private final AuditReportDao reports;private final TokenService tokens;
    @Inject public ProductAnalyticsService(Config config,ProductAnalyticsDao dao,AdminReadAccess access,AuditReportDao reports,TokenService tokens) {
        enabled=config.hasPath("product-analytics.enabled")&&config.getBoolean("product-analytics.enabled");this.dao=dao;this.access=access;this.reports=reports;this.tokens=tokens;
    }
    public boolean enabled(String authorization) { access.require(authorization); return enabled && dao.collectionEnabled(); }
    public void count(ProductEvent event,String authorization) { access.require(authorization);if(enabled) safe(()->dao.count(event,Instant.now())); }
    public void attribute(long runId,AnalyticsDimensions dimensions,String authorization) {
        if(!enabled || dimensions==null)return;
        safe(()->{access.require(authorization);dao.attribute(runId,dimensions,Instant.now());});
    }
    public void viewed(String token,String authorization,String consent) {
        if(!enabled || !"granted".equals(consent))return;
        safe(()->{access.require(authorization);reports.findByTokenHash(tokens.sha256(token)).ifPresent(report->dao.viewed(report.getRunId(),Instant.now()));});
    }
    public ProductMetrics.Summary metrics(int days,AccountSessionService.Context context) {
        AdminService.requireAdmin(context);
        if(!Set.of(7,30,90).contains(days))throw new AccountError(400,"filter_invalid");
        Instant now=Instant.now(),from=now.minus(Duration.ofDays(days));return ProductMetrics.summarize(dao.sample(from,now),from,now,days,enabled && dao.collectionEnabled());
    }
    public void purgeTelemetry() { safe(()->dao.purgeTelemetry(Instant.now())); }
    private void safe(Runnable operation){try{operation.run();}catch(RuntimeException unavailable){LOG.debug("Product telemetry omitted: {}",unavailable.getClass().getSimpleName());}}
}
