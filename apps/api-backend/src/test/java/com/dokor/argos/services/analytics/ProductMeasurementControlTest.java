package com.dokor.argos.services.analytics;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.querydsl.sql.*;
import com.typesafe.config.ConfigFactory;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.BiFunction;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductMeasurementControlTest {
    JdbcDataSource source;
    AccountDao dao;
    AccountSessionService sessions;
    AccountUser user;
    Clock clock = Clock.fixed(Instant.parse("2026-10-16T10:00:00Z"), ZoneOffset.UTC);
    @BeforeEach void setup() throws Exception {
        source = new JdbcDataSource(); source.setURL("jdbc:h2:mem:measurement-" + UUID.randomUUID() + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        try(var c=source.getConnection();var s=c.createStatement()) {
            s.execute("CREATE TABLE ARG_PRODUCT_SETTING(id BIGINT PRIMARY KEY,enabled BOOLEAN,version BIGINT,enabled_since TIMESTAMP,last_collected_at TIMESTAMP)");
            s.execute("INSERT INTO ARG_PRODUCT_SETTING VALUES(1,FALSE,0,NULL,NULL)");
            s.execute("CREATE TABLE ARG_ADMIN_EVENT(id BIGINT PRIMARY KEY,actor_id BIGINT,target_id BIGINT,old_offer VARCHAR(16),new_offer VARCHAR(16),old_limit BIGINT,new_limit BIGINT,created_at TIMESTAMP,old_state VARCHAR(16),new_state VARCHAR(16),reason_code VARCHAR(32),request_id VARCHAR(64),event_type VARCHAR(32),old_enabled BOOLEAN,new_enabled BOOLEAN)");
            s.execute("CREATE TABLE ARG_PRODUCT_AUDIT_ATTR(run_id BIGINT PRIMARY KEY,source_route VARCHAR(100),locale VARCHAR(8),placement VARCHAR(32),created_at TIMESTAMP,first_viewed_at TIMESTAMP,audience VARCHAR(16) DEFAULT 'unknown')");
            s.execute("CREATE TABLE ARG_AUDIT_RUN(id BIGINT PRIMARY KEY,created_at TIMESTAMP,owner_user_id BIGINT)");
            s.execute("INSERT INTO ARG_AUDIT_RUN VALUES(1,'2000-01-01',NULL),(2,'2026-10-16 10:00:00',NULL)");
            s.execute("CREATE TABLE ARG_PRODUCT_EVENT_COUNT(event_day DATE,event_name VARCHAR(100),source_route VARCHAR(100),locale VARCHAR(8),placement VARCHAR(32),error_category VARCHAR(32),event_count BIGINT DEFAULT 1,PRIMARY KEY(event_day,event_name,source_route,locale,placement,error_category))");
        }
        dao = new AccountDao(new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT)));
        user = new AccountUser(); user.setId(10L); user.setRole("ADMIN"); user.setState("ACTIVE");
        sessions=mock(AccountSessionService.class);
        when(sessions.with(any(),any(),anyBoolean(),anyBoolean(),any())).thenAnswer(call -> {
            BiFunction<AccountSessionService.Context,Connection,?> work=call.getArgument(4);
            return dao.transaction(c -> work.apply(new AccountSessionService.Context(user,new AccountSession()),c));
        });
    }
    ProductMeasurementControl control(boolean allowed) { return new ProductMeasurementControl(dao,sessions,clock,ConfigFactory.parseString("product-analytics.enabled="+allowed)); }
    ProductMeasurementControl.Change change(boolean on,long version) { return new ProductMeasurementControl.Change(on,version,true); }
    @Test void durableSwitchLogsOnlyActualChangesAndSurvivesNewServiceInstances() throws Exception {
        var first=control(true); assertFalse(first.read("auth").enabled());
        assertTrue(first.change("auth","csrf",change(true,0)).enabled());
        assertTrue(control(true).read("auth").enabled());
        assertEquals(1,first.change("auth","csrf",change(true,1)).version());
        assertFalse(first.change("auth","csrf",change(false,1)).enabled());
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT actor_id,old_enabled,new_enabled,event_type,target_id FROM ARG_ADMIN_EVENT ORDER BY created_at,id")) {
            assertTrue(r.next()); assertEquals(10,r.getLong(1)); assertFalse(r.getBoolean(2)); assertTrue(r.getBoolean(3)); assertEquals("PRODUCT_MEASUREMENT",r.getString(4)); assertNull(r.getObject(5));
            assertTrue(r.next()); assertTrue(r.getBoolean(2)); assertFalse(r.getBoolean(3)); assertFalse(r.next());
        }
    }
    @Test void deploymentGateVersionConsentConfirmationAndRoleAreEnforced() {
        assertEquals(409,assertThrows(AccountError.class,()->control(false).change("auth","csrf",change(true,0))).getResponse().getStatus());
        assertFalse(control(false).read("auth").deploymentAllowed());
        assertEquals(403,assertThrows(AccountError.class,()->control(true).change("auth",null,change(true,0))).getResponse().getStatus());
        assertEquals(400,assertThrows(AccountError.class,()->control(true).change("auth","csrf",new ProductMeasurementControl.Change(true,0L,false))).getResponse().getStatus());
        control(true).change("auth","csrf",change(true,0));
        assertEquals(409,assertThrows(AccountError.class,()->control(true).change("auth","csrf",change(false,0))).getResponse().getStatus());
        user.setRole("USER");
        assertEquals(403,assertThrows(AccountError.class,()->control(true).read("auth")).getResponse().getStatus());
        assertEquals(403,assertThrows(AccountError.class,()->control(true).change("auth","csrf",change(false,1))).getResponse().getStatus());
    }
    @Test void simultaneousAdministratorsCannotOverwriteEachOther() throws Exception {
        var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var work=(Callable<Integer>)()->{start.await();try {control(true).change("auth","csrf",change(true,0));return 200;}catch(AccountError e){return e.getResponse().getStatus();}};
            var a=executor.submit(work);var b=executor.submit(work);start.countDown();
            assertEquals(Set.of(200,409),Set.of(a.get(5,TimeUnit.SECONDS),b.get(5,TimeUnit.SECONDS)));
            assertEquals(1,control(true).read("auth").version());
        }
    }
    @Test void disableStopsNewWritesAndReenableDoesNotBackfillOldReportViews() throws Exception {
        var analytics=new ProductAnalyticsDao(dao.transactions);
        var d=new AnalyticsDimensions("/","fr","form");var event=new ProductEvent("audit_cta_click",d,"none");
        analytics.count(event,clock.instant());
        assertFalse(analytics.collectionEnabled());
        control(true).change("auth","csrf",change(true,0));
        analytics.count(event,clock.instant());
        analytics.attribute(1,d,clock.instant()); // Old run: no retrospective attribution.
        analytics.attribute(2,d,clock.instant());
        try(var c=source.getConnection();var s=c.createStatement()) {s.execute("INSERT INTO ARG_PRODUCT_AUDIT_ATTR VALUES(3,'/','fr','form','2000-01-01',NULL,'unknown')");}
        analytics.viewed(3,clock.instant());
        control(true).change("auth","csrf",change(false,1));
        analytics.count(event,clock.instant().plusSeconds(1));
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT (SELECT SUM(event_count) FROM ARG_PRODUCT_EVENT_COUNT),(SELECT first_viewed_at FROM ARG_PRODUCT_AUDIT_ATTR WHERE run_id=3),(SELECT last_collected_at FROM ARG_PRODUCT_SETTING WHERE id=1),(SELECT COUNT(*) FROM ARG_PRODUCT_AUDIT_ATTR WHERE run_id=1),(SELECT COUNT(*) FROM ARG_PRODUCT_AUDIT_ATTR WHERE run_id=2)")) {
            assertTrue(r.next());assertEquals(1,r.getLong(1));assertNull(r.getObject(2));assertNotNull(r.getObject(3));assertEquals(0,r.getInt(4));assertEquals(1,r.getInt(5));
        }
        assertNotNull(control(true).read("auth").lastCollectedAt());
        var later = Clock.offset(clock, Duration.ofHours(1));
        new ProductMeasurementControl(dao,sessions,later,ConfigFactory.parseString("product-analytics.enabled=true"))
                .change("auth","csrf",change(true,2));
        analytics.viewed(2,later.instant());
        try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("SELECT first_viewed_at FROM ARG_PRODUCT_AUDIT_ATTR WHERE run_id=2")) {
            assertTrue(r.next()); assertNull(r.getObject(1));
        }
    }
}
