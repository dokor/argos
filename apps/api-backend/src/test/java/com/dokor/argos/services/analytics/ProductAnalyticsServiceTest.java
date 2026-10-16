package com.dokor.argos.services.analytics;

import com.dokor.argos.db.dao.AuditReportDao;
import com.dokor.argos.services.configuration.ConfigurationService;
import com.dokor.argos.services.token.TokenService;
import com.dokor.argos.services.security.AdminReadAccess;
import com.typesafe.config.ConfigFactory;
import jakarta.ws.rs.NotAuthorizedException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import com.dokor.argos.db.generated.AccountUser;
import com.dokor.argos.db.generated.AccountSession;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.account.AccountSessionService;
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
    @Test void directCollectionRequiresRealServerCredential() {
        var on=service(true);
        assertThrows(NotAuthorizedException.class,()->on.count(event,null));
        on.attribute(1,event.dimensions(),"Bearer wrong");
        on.viewed("synthetic","Bearer wrong","granted");
        verifyNoInteractions(dao,reports);
    }
    @Test void productMetricsRejectNonAdminAndUnverifiedAccountsBeforeStorage() {
        var user = new AccountUser(); user.setState("ACTIVE"); user.setRole("USER");
        var context = new AccountSessionService.Context(user, new AccountSession());
        assertThrows(AccountError.class, () -> service(true).metrics(30, context));
        user.setRole("ADMIN"); user.setState("PENDING");
        assertThrows(AccountError.class, () -> service(true).metrics(30, context));
        verifyNoInteractions(dao, reports);
    }
    @Test void invalidPeriodNeverReachesStorageEvenForAnAdministrator() {
        var user = new AccountUser(); user.setState("ACTIVE"); user.setRole("ADMIN");
        var context = new AccountSessionService.Context(user, new AccountSession());
        assertThrows(AccountError.class, () -> service(true).metrics(1, context));
        verifyNoInteractions(dao, reports);
    }
    @Test void storageFailureDoesNotFailBusinessAttribution() {
        doThrow(new IllegalStateException("synthetic fixture only")).when(dao).attribute(eq(1L),any(),any(Instant.class));
        assertDoesNotThrow(()->service(true).attribute(1,event.dimensions(),"Bearer synthetic-fixture"));
        verify(dao).attribute(eq(1L),eq(event.dimensions()),any(Instant.class));
    }
}
