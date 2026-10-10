package com.dokor.argos.services.analytics;

import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.token.TokenService;
import com.dokor.argos.webservices.api.audits.AdminReadAccess;
import com.typesafe.config.ConfigFactory;
import jakarta.ws.rs.NotAuthorizedException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductAnalyticsServiceTest {
    private final ProductAnalyticsDao dao=mock(ProductAnalyticsDao.class);
    private final AuditReportDao reports=mock(AuditReportDao.class);
    private final ProductEvent event=new ProductEvent("public_page_view",new AnalyticsDimensions("/","fr","page"),"none");
    private ProductAnalyticsService service(boolean enabled) {
        var configuration=mock(ConfigurationService.class);
        when(configuration.adminApiToken()).thenReturn("synthetic-fixture");
        return new ProductAnalyticsService(ConfigFactory.parseString("product-analytics.enabled="+enabled),dao,new AdminReadAccess(configuration),reports,new TokenService());
    }
    @Test void disabledCollectionAndAbsentConsentNeverReachStorage() {
        var off=service(false);
        off.count(event,"Bearer synthetic-fixture");off.attribute(1,event.dimensions(),"Bearer synthetic-fixture");off.viewed("synthetic","Bearer synthetic-fixture","granted");
        service(true).viewed("synthetic","Bearer synthetic-fixture","refused");
        verifyNoInteractions(dao,reports);
    }
    @Test void directCollectionAndAdminMetricsRequireRealServerCredential() {
        var on=service(true);
        assertThrows(NotAuthorizedException.class,()->on.count(event,null));
        assertThrows(NotAuthorizedException.class,()->on.metrics(30,"Bearer wrong"));
        on.attribute(1,event.dimensions(),"Bearer wrong");
        on.viewed("synthetic","Bearer wrong","granted");
        verifyNoInteractions(dao,reports);
    }
    @Test void storageFailureDoesNotFailBusinessAttribution() {
        doThrow(new IllegalStateException("synthetic fixture only")).when(dao).attribute(eq(1L),any(),any(Instant.class));
        assertDoesNotThrow(()->service(true).attribute(1,event.dimensions(),"Bearer synthetic-fixture"));
        verify(dao).attribute(eq(1L),eq(event.dimensions()),any(Instant.class));
    }
}
