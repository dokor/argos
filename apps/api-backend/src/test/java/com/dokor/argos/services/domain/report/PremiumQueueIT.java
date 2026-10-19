package com.dokor.argos.services.domain.report;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.scheduler.AuditQueuePolicy;
import com.querydsl.sql.*;
import com.typesafe.config.ConfigFactory;
import java.time.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

/** Actual MariaDB selection, current rights, aging and owner fairness; no external scan. */
class PremiumQueueIT extends MariaDbReportFixture {
    private final Instant now = Instant.parse("2026-10-19T12:00:00Z");
    private AuditRunDao priority, standard;
    @BeforeEach void queueFixtures() throws Exception {
        sql("UPDATE ARG_AUDIT_RUN SET status='FAILED' WHERE status='QUEUED'");
        var tx = new TransactionManagerQuerydsl(source, new Configuration(MySQLTemplates.DEFAULT));
        var clock = Clock.fixed(now, ZoneOffset.UTC);
        var usage = new UsageService(tx, new UsagePolicy(ConfigFactory.load()), clock);
        priority = new AuditRunDao(tx, usage, new AuditQueuePolicy(ConfigFactory.parseString(
            "audit.queue.premium-priority-enabled=true")), clock);
        standard = new AuditRunDao(tx, usage, new AuditQueuePolicy(ConfigFactory.load()), clock);
        sql("INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,offer,created_at) VALUES"
            + "(20,'free@example.com','Queue fixture','ACTIVE','FREE',NOW()),"
            + "(21,'premium@example.com','Queue fixture','ACTIVE','PREMIUM',NOW()),"
            + "(22,'other@example.com','Queue fixture','ACTIVE','PREMIUM',NOW())");
        sql("INSERT INTO ARG_ACCOUNT_CI_ENTITLEMENT(id,ci_access,valid_until,updated_at) VALUES"
            + "(21,1,'2026-10-20',NOW()),(22,1,'2026-10-20',NOW())");
    }
    private void queued(long id, Long owner, int secondsAgo) throws Exception {
        try(var c=source.getConnection();var s=c.prepareStatement(
            "INSERT INTO ARG_AUDIT_RUN(id,audit_id,owner_user_id,status,created_at) VALUES(?,1,?,'QUEUED',?)")) {
            s.setLong(1,id);s.setObject(2,owner);s.setTimestamp(3,java.sql.Timestamp.from(now.minusSeconds(secondsAgo)));s.executeUpdate();
        }
    }
    @Test void disabledFlagPreservesExistingOrderButEnabledPriorityFavorsEligiblePremium() throws Exception {
        queued(100,20L,10);queued(101,21L,5);
        assertEquals(100,standard.findNextQueuedRun().orElseThrow().getId());
        assertEquals(101,priority.findNextQueuedRun().orElseThrow().getId());
    }
    @Test void olderAnonymousAndFreeRequestsProgressBeforeNewPremiumWork() throws Exception {
        queued(100,null,130);queued(101,20L,121);queued(102,21L,5);
        assertEquals(100,priority.findNextQueuedRun().orElseThrow().getId());
        assertTrue(priority.claimRun(100,"synthetic-priority-anonymous",now));
        assertEquals(101,priority.findNextQueuedRun().orElseThrow().getId());
        assertTrue(priority.claimRun(101,"synthetic-priority-free",now));
        assertEquals(102,priority.findNextQueuedRun().orElseThrow().getId());
    }
    @Test void currentExpiredRevokedSuspendedAndDowngradedRightsCannotBuyPriority() throws Exception {
        queued(100,20L,10);queued(101,21L,5);
        for(String change:new String[]{"UPDATE ARG_ACCOUNT_CI_ENTITLEMENT SET valid_until='2026-10-19 12:00:00' WHERE id=21",
            "UPDATE ARG_ACCOUNT_CI_ENTITLEMENT SET ci_access=0 WHERE id=21",
            "UPDATE ARG_ACCOUNT_USER SET state='SUSPENDED' WHERE id=21",
            "UPDATE ARG_ACCOUNT_USER SET offer='FREE' WHERE id=21"}) {
            sql(change);assertEquals(100,priority.findNextQueuedRun().orElseThrow().getId());
            sql("UPDATE ARG_ACCOUNT_USER SET state='ACTIVE',offer='PREMIUM' WHERE id=21");
            sql("UPDATE ARG_ACCOUNT_CI_ENTITLEMENT SET ci_access=1,valid_until='2026-10-20' WHERE id=21");
        }
        sql("DELETE FROM ARG_ACCOUNT_CI_ENTITLEMENT WHERE id=21");
        assertEquals(100,priority.findNextQueuedRun().orElseThrow().getId());
    }
    @Test void priorityKeepsFairRotationBetweenPremiumOwnersAndAtomicClaims() throws Exception {
        queued(100,21L,10);queued(101,21L,9);queued(102,22L,5);
        assertEquals(100,priority.findNextQueuedRun().orElseThrow().getId());
        assertTrue(priority.claimRun(100,"synthetic-priority-first",now));
        assertFalse(priority.claimRun(100,"synthetic-priority-second",now));
        assertEquals(102,priority.findNextQueuedRun().orElseThrow().getId());
    }
}
