package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.PremiumWaitlistDao;
import com.dokor.argos.services.domain.premium.PremiumWaitlistService;
import com.querydsl.sql.*;
import java.time.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

@org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="ARGOS_TEST_CREDENTIALS_URL",matches=".+")
class PremiumWaitlistIT extends MariaDbReportFixture {
    @Test void concurrentDuplicatesRemainSeparateFromNewsletterAndExpireWithoutRenewal() throws Exception {
        var now = Instant.parse("2026-10-16T10:00:00Z");
        var dao = new PremiumWaitlistDao(new TransactionManagerQuerydsl(source,new Configuration(MySQLTemplates.DEFAULT)));
        var service = new PremiumWaitlistService(dao,Clock.fixed(now,ZoneOffset.UTC));
        try (var pool = Executors.newFixedThreadPool(8)) {
            var start = new CyclicBarrier(8); var results = new java.util.ArrayList<Future<Boolean>>();
            for (int i=0;i<8;i++) results.add(pool.submit(() -> { start.await(); return service.subscribe("Synthetic@Example.com",true,"fr"); }));
            for (var result : results) assertTrue(result.get(10,TimeUnit.SECONDS));
        }
        assertTrue(new PremiumWaitlistService(dao,Clock.fixed(now.plusSeconds(100),ZoneOffset.UTC)).subscribe("synthetic@example.com",true,"en"));
        try (var c=source.getConnection(); var s=c.createStatement(); var r=s.executeQuery("SELECT COUNT(*),MIN(locale),MIN(consent_version),UNIX_TIMESTAMP(MIN(expires_at))-UNIX_TIMESTAMP(MIN(created_at)) FROM ARG_PREMIUM_WAITLIST")) {
            assertTrue(r.next()); assertEquals(1,r.getInt(1)); assertEquals("fr",r.getString(2));
            assertEquals(PremiumWaitlistService.CONSENT_VERSION,r.getString(3)); assertEquals(365*86400,r.getLong(4));
        }
        try (var c=source.getConnection(); var s=c.createStatement(); var r=s.executeQuery("SELECT COUNT(*) FROM ARG_NEWSLETTER_SUBSCRIBER")) { assertTrue(r.next()); assertEquals(0,r.getInt(1)); }
        assertEquals(0,dao.purgeExpired(Instant.parse("2027-10-16T09:59:59Z")));
        assertEquals(1,dao.purgeExpired(Instant.parse("2027-10-16T10:00:00Z")));
    }
}
