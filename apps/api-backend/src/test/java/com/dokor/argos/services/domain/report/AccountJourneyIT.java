package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.services.analytics.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.sql.Configuration;
import com.querydsl.sql.MySQLTemplates;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AccountJourneyIT extends MariaDbReportFixture {
    private final Instant now = Instant.parse("2026-10-17T12:00:00Z");
    private AccountJourneyDao journey;

    private void prepare() throws Exception {
        sql("UPDATE ARG_PRODUCT_SETTING SET enabled=TRUE,enabled_since='2000-01-01' WHERE id=1");
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,role,offer,created_at) VALUES"
                + "(101,'one@example.test','One','ACTIVE','USER','FREE','2026-01-01'),"
                + "(102,'two@example.test','Two','ACTIVE','USER','FREE','2026-01-01'),"
                + "(103,'three@example.test','Three','ACTIVE','USER','FREE','2026-01-01')");
        journey = new AccountJourneyDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
    }

    private void event(AccountJourneyEvent event, long subject, long user, Instant when) {
        journey.record(event, subject, user, event == AccountJourneyEvent.REGISTERED ? "google" : "none", "en", when);
    }

    @Test void deduplicatesBusinessOutcomesAndDailyActivityWithMatureRetentionDenominators() throws Exception {
        prepare();
        Instant first = Instant.parse("2026-10-08T08:00:00Z"), old = Instant.parse("2026-09-15T08:00:00Z");
        for (int retry = 0; retry < 2; retry++) {
            event(AccountJourneyEvent.REGISTERED, 101, 101, first);
            event(AccountJourneyEvent.REGISTERED, 102, 102, now.minus(Duration.ofDays(1)));
            event(AccountJourneyEvent.REGISTERED, 103, 103, old);
            event(AccountJourneyEvent.ACTIVATED, 101, 101, first.plusSeconds(60));
            event(AccountJourneyEvent.CLAIMED, 1, 101, first.plusSeconds(60));
            event(AccountJourneyEvent.AUTHENTICATED, 11, 101, first);
            event(AccountJourneyEvent.ACTIVITY, 101, 101, first);
            event(AccountJourneyEvent.ACTIVITY, 101, 101, first.plus(Duration.ofDays(7)));
            event(AccountJourneyEvent.ACTIVITY, 103, 103, old);
            event(AccountJourneyEvent.ACTIVITY, 103, 103, old.plus(Duration.ofDays(30)));
            event(AccountJourneyEvent.ACTIVITY, 102, 102, now.minusSeconds(1));
        }
        var summary = journey.summary(now.minus(Duration.ofDays(90)), now);
        assertEquals(3, summary.activeAccounts()); assertEquals(2, summary.returningAccounts());
        assertEquals(5, summary.activityDays()); assertEquals(1, summary.authentications()); assertEquals(1, summary.claimedReports());
        var cohort = summary.cohorts().getFirst();
        assertEquals(3, cohort.registered()); assertEquals(1, cohort.activated()); assertEquals(1, cohort.claimed());
        assertEquals(new AccountJourneyDao.Retention(2, 1), cohort.day7());
        assertEquals(new AccountJourneyDao.Retention(1, 1), cohort.day30());
        String json = new ObjectMapper().writeValueAsString(summary);
        assertFalse(json.contains("userId")); assertFalse(json.contains("subject")); assertFalse(json.contains("example.test"));
    }

    @Test void exactDayMaturityDisableAndPurgePreserveOperationalData() throws Exception {
        prepare();
        Instant registered = Instant.parse("2026-10-01T23:59:00Z");
        event(AccountJourneyEvent.REGISTERED, 101, 101, registered);
        event(AccountJourneyEvent.ACTIVITY, 101, 101, Instant.parse("2026-10-08T00:00:00Z"));
        var before = journey.summary(registered.minusSeconds(1), Instant.parse("2026-10-08T23:59:59Z"));
        assertEquals(new AccountJourneyDao.Retention(0, 0), before.cohorts().getFirst().day7());
        var after = journey.summary(registered.minusSeconds(1), Instant.parse("2026-10-09T00:00:00Z"));
        assertEquals(new AccountJourneyDao.Retention(1, 1), after.cohorts().getFirst().day7());
        sql("UPDATE ARG_PRODUCT_SETTING SET enabled=FALSE WHERE id=1");
        event(AccountJourneyEvent.REGISTERED, 102, 102, now.minusSeconds(1));
        assertEquals(1, journey.summary(registered.minusSeconds(1), now).cohorts().getFirst().registered());
        sql("UPDATE ARG_PRODUCT_ACCOUNT_EVENT SET occurred_at='2000-01-01'");
        var analytics = new ProductAnalyticsDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
        assertEquals(2, analytics.purgeTelemetry(now));
        assertEquals(0, journey.summary(Instant.EPOCH, now).cohorts().size());
        try (var c = source.getConnection(); var q = c.createStatement(); var row = q.executeQuery("SELECT COUNT(*) FROM ARG_ACCOUNT_USER")) {
            assertTrue(row.next()); assertEquals(3, row.getLong(1));
        }
    }

    @Test void migrationDoesNotReconstructAccountHistoryOrHistoricalAudience() throws Exception {
        var old = org.flywaydb.core.Flyway.configure().dataSource(source).cleanDisabled(false).target("36").load();
        old.clean(); old.migrate();
        sql("INSERT INTO ARG_ACCOUNT_USER(id,display_name,state,role,offer,created_at) VALUES(101,'Existing','ACTIVE','USER','FREE','2026-01-01')");
        sql("INSERT INTO ARG_DOMAIN(id,hostname) VALUES(1,'example.test')");
        sql("INSERT INTO ARG_AUDIT(id,domain_id,input_url,normalized_url) VALUES(1,1,'https://example.test','https://example.test')");
        sql("INSERT INTO ARG_AUDIT_RUN(id,audit_id,status,owner_user_id) VALUES(1,1,'COMPLETED',101)");
        sql("INSERT INTO ARG_PRODUCT_AUDIT_ATTR(run_id,source_route,locale,placement,created_at) VALUES(1,'/','fr','form','2026-01-01')");
        var current = org.flywaydb.core.Flyway.configure().dataSource(source).load();
        assertEquals(1, current.migrate().migrationsExecuted); current.validate();
        assertEquals(0, current.migrate().migrationsExecuted);
        try (var c = source.getConnection(); var q = c.createStatement();
                var row = q.executeQuery("SELECT audience,(SELECT COUNT(*) FROM ARG_PRODUCT_ACCOUNT_EVENT) FROM ARG_PRODUCT_AUDIT_ATTR")) {
            assertTrue(row.next()); assertEquals("unknown", row.getString(1)); assertEquals(0, row.getLong(2));
        }
    }

    @Test void audienceIsRecordedAtCreationAndDoesNotChangeWhenClaimed() throws Exception {
        prepare();
        var analytics = new ProductAnalyticsDao(new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT)));
        var dimensions = new AnalyticsDimensions("/", "fr", "form");
        analytics.attribute(1, dimensions, Instant.now());
        sql("UPDATE ARG_AUDIT_RUN SET owner_user_id=101 WHERE id IN (1,2)");
        analytics.attribute(1, dimensions, Instant.now()); analytics.attribute(2, dimensions, Instant.now());
        var sample = analytics.sample(Instant.EPOCH, Instant.now().plusSeconds(1));
        assertEquals(1, sample.cohort().stream().filter(row -> row.audience().equals("visitor")).count());
        assertEquals(1, sample.cohort().stream().filter(row -> row.audience().equals("account")).count());
    }
}
